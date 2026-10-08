/** Exercises report orchestration, filtering, streaming, and cancellation. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRunner } from '../server/runner.js';
import { configSchema } from '../server/config.js';
import { createApp } from '../server/app.js';

const tabId = '159f4603-eaee-47c4-bd9a-a43308e80545';
const config = configSchema.parse({
  title: 'Engineer',
  roles: ['Engineer'],
  companies: ['Acme'],
  limit: 20,
});
const job = {
  title: 'Engineer',
  company: 'Acme',
  summary: 'Build software',
  fitScore: 80,
  keyGaps: [],
  missingKeywords: [],
  resumeMatch: 'Good',
};

function fixture() {
  const providers = {
    search: async () => [{
      url: 'https://example.com/job',
      title: 'Engineer',
      snippet: 'Acme Engineer TypeScript',
    }],
    scrape: async () => null,
    evaluate: async () => job,
  };

  return {
    providers,
    input: { tabId, config, history: [] },
    run: () => makeRunner(providers),
  };
}

async function serve(t, run) {
  const server = createApp(run).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://localhost:${server.address().port}`;
}

test('HTTP streams searching before provider finishes and then sends report', async (t) => {
  const f = fixture();
  let release;
  f.providers.search = () => new Promise((resolve) => { release = resolve; });
  const base = await serve(t, f.run());
  const response = await fetch(`${base}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(f.input),
  });

  assert.match(response.headers.get('content-type'), /ndjson/);
  const reader = response.body.getReader();
  const first = await reader.read();
  assert.match(new TextDecoder().decode(first.value), /"stage":"searching"/);

  release([{ url: 'https://example.com/job', title: 'Engineer', snippet: 'Acme' }]);
  let rest = '';
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    rest += new TextDecoder().decode(chunk.value);
  }

  const events = rest.trim().split('\n').map(JSON.parse);
  assert.deepEqual(
    events.filter((event) => event.type === 'progress').map((event) => event.stage),
    ['scraping', 'generating'],
  );
  assert.equal(events.at(-1).report.results.length, 1);
});

test('recent title/company and URL history filters duplicates', async () => {
  const f = fixture();
  f.input.history = [{
    title: 'ENGINEER',
    company: 'Acme',
    url: 'https://other.com/job',
    recordedAt: new Date().toISOString(),
  }];
  assert.equal((await f.run()(f.input)).results.length, 0);

  f.input.history[0].title = 'Other';
  f.input.history[0].url = 'https://example.com/job';
  assert.equal((await f.run()(f.input)).results.length, 0);
});

test('old and future history cannot suppress jobs', async () => {
  const f = fixture();

  for (const date of ['2000-01-01T00:00:00Z', '2099-01-01T00:00:00Z']) {
    f.input.history = [{ ...job, url: 'https://example.com/job', recordedAt: date }];
    assert.equal((await f.run()(f.input)).results.length, 1);
  }
});

test('strict skills filter and scrape fallback', async () => {
  const f = fixture();
  f.input.config = { ...config, skills: ['Rust'], strictSkills: true };
  assert.equal((await f.run()(f.input)).results.length, 0);

  f.input.config = config;
  f.providers.scrape = async () => { throw new Error('blocked'); };
  const report = await f.run()(f.input);
  assert.equal(report.results.length, 1);
  assert.equal(report.warnings.length, 1);
});

test('provider failure produces an error event without a completed report', async (t) => {
  const f = fixture();
  f.providers.search = async () => { throw new Error('offline'); };
  const base = await serve(t, f.run());
  const response = await fetch(`${base}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(f.input),
  });
  const events = (await response.text()).trim().split('\n').map(JSON.parse);

  assert.equal(events.at(-1).type, 'error');
  assert.ok(!events.some((event) => event.type === 'complete'));
});

test('aborted runner stops before next paid call', async () => {
  const f = fixture();
  const controller = new AbortController();
  let evaluated = false;

  f.providers.scrape = async () => {
    controller.abort();
    return 'page';
  };
  f.providers.evaluate = async () => {
    evaluated = true;
    return job;
  };

  await assert.rejects(f.run()(f.input, () => {}, controller.signal));
  assert.equal(evaluated, false);
});

test('invalid configuration is rejected before stream or provider call', async (t) => {
  let invoked = false;
  const base = await serve(t, () => { invoked = true; });
  const response = await fetch(`${base}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabId, config: { ...config, limit: 21 } }),
  });

  assert.equal(response.status, 400);
  assert.equal(invoked, false);
});

test('news deduplicates URLs rather than company/title', async () => {
  const f = fixture();
  f.input.config = { ...config, mode: 'news', prompt: 'Tech' };
  f.input.history = [{
    ...job,
    url: 'https://other.com',
    recordedAt: new Date().toISOString(),
  }];

  assert.equal((await f.run()(f.input)).results.length, 1);
});

test('closing the HTTP stream aborts in-flight provider work', async (t) => {
  const f = fixture();
  let markAborted;
  const cancelled = new Promise((resolve) => { markAborted = resolve; });
  f.providers.search = async (config, signal) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => {
      markAborted();
      reject(signal.reason);
    }, { once: true });
  });

  const base = await serve(t, f.run());
  const response = await fetch(`${base}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(f.input),
  });
  const reader = response.body.getReader();
  await reader.read();
  await reader.cancel();

  await Promise.race([
    cancelled,
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Provider did not abort')), 2000);
      timer.unref();
    }),
  ]);
});
