/** Verifies provider request construction, pagination, and response validation. */
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { providers } from '../server/providers.js';
import { configSchema } from '../server/config.js';

const config = configSchema.parse({
  title: 'Jobs',
  roles: ['Engineer'],
  limit: 20,
  resume: 'PRIVATE',
});

function env(t: TestContext, values: Record<string, string | undefined>) {
  const previous: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

function response(data: unknown) {
  return { ok: true, json: async () => data };
}

test('SerpApi defaults, paginates to 20 and does not send resume', async (t) => {
  env(t, { SERPAPI_API_KEY: 'test', SEARCH_PROVIDER: undefined });
  const calls: URL[] = [];

  t.mock.method(global, 'fetch', async (url: URL) => {
    calls.push(url);
    return response({
      search_metadata: { status: 'Success' },
      organic_results: Array.from({ length: 10 }, (_, index) => ({
        title: 'Job',
        link: `https://example.com/${calls.length}/${index}`,
        snippet: 'Job',
      })),
      serpapi_pagination: { next: 'https://not-followed.example.com' },
    });
  });

  const results = await providers.search(config);
  assert.equal(results.length, 20);
  assert.deepEqual(results[0], {
    title: 'Job',
    url: 'https://example.com/1/0',
    snippet: 'Job',
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((url) => url.searchParams.get('start')), ['0', '10']);
  assert.ok(calls.every((url) => (
    url.origin === 'https://serpapi.com'
      && url.searchParams.get('engine') === 'google'
      && url.searchParams.get('api_key') === 'test'
      && !url.searchParams.has('num')
      && !url.toString().includes('PRIVATE')
  )));
});

test('SerpApi caps small requests and supplies empty snippet fallback', async (t) => {
  env(t, { SERPAPI_API_KEY: 'test', SEARCH_PROVIDER: 'serpapi' });
  let calls = 0;

  t.mock.method(global, 'fetch', async () => {
    calls += 1;
    return response({
      organic_results: Array.from({ length: 10 }, (_, index) => ({
        title: 'Job',
        link: `https://example.com/${index}`,
      })),
      serpapi_pagination: { next: 'next' },
    });
  });

  const results = await providers.search({ ...config, limit: 3 });
  assert.equal(results.length, 3);
  assert.equal(results[0].snippet, '');
  assert.equal(calls, 1);
});

test('SerpApi stops without a next page, including successful empty results', async (t) => {
  env(t, { SERPAPI_API_KEY: 'test', SEARCH_PROVIDER: 'serpapi' });
  let calls = 0;

  t.mock.method(global, 'fetch', async () => {
    calls += 1;
    return response({ search_metadata: { status: 'Success' }, organic_results: [] });
  });

  assert.deepEqual(await providers.search(config), []);
  assert.equal(calls, 1);
});

test('SerpApi JSON errors and HTTP errors fail the run', async (t) => {
  env(t, { SERPAPI_API_KEY: 'test', SEARCH_PROVIDER: 'serpapi' });
  const fetch = t.mock.method(global, 'fetch', async () => response({
    error: 'private provider details',
    search_metadata: { status: 'Error' },
  }));

  await assert.rejects(providers.search(config), /SerpApi search failed/);
  fetch.mock.mockImplementation(async () => ({ ok: false, status: 429 } as Response));
  await assert.rejects(providers.search(config), /HTTP 429/);
});

test('SerpApi credentials are required and removed Google option is rejected', async (t) => {
  env(t, { SERPAPI_API_KEY: undefined, SEARCH_PROVIDER: undefined });

  await assert.rejects(providers.search(config), /Missing SERPAPI_API_KEY/);
  process.env.SEARCH_PROVIDER = 'google';
  await assert.rejects(providers.search(config), /serpapi or firecrawl/);
});

test('news prompts use SerpApi without resume or job-board filters', async (t) => {
  env(t, { SERPAPI_API_KEY: 'test', SEARCH_PROVIDER: 'serpapi' });
  t.mock.method(global, 'fetch', async (url: URL) => {
    assert.equal(url.searchParams.get('q'), 'New developer technologies');
    assert.ok(!url.toString().includes('PRIVATE'));
    return response({ organic_results: [] });
  });

  await providers.search({ ...config, mode: 'news', prompt: 'New developer technologies' });
});

test('Firecrawl search maps v2 web results', async (t) => {
  env(t, { SEARCH_PROVIDER: 'firecrawl', FIRECRAWL_API_KEY: 'test' });
  t.mock.method(global, 'fetch', async (url: URL, options?: RequestInit) => {
    assert.equal(JSON.parse(String(options?.body)).limit, 20);
    return response({
      success: true,
      data: { web: [{ title: 'Job', url: 'https://example.com', description: 'Engineer' }] },
    });
  });

  assert.deepEqual(await providers.search(config), [{
    title: 'Job',
    url: 'https://example.com',
    snippet: 'Engineer',
  }]);
});

test('structured evaluations reject invalid scores', async (t) => {
  env(t, { OPENAI_API_KEY: 'test' });
  t.mock.method(global, 'fetch', async (url: URL, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body));
    assert.equal(body.response_format.type, 'json_schema');
    return response({
      choices: [{
        message: {
          content: JSON.stringify({
            title: 'Engineer',
            company: 'Acme',
            summary: 'Job',
            fitScore: 200,
            keyGaps: [],
            missingKeywords: [],
            resumeMatch: 'Match',
          }),
        },
      }],
    });
  });

  await assert.rejects(providers.evaluate(config, {
    title: 'Job',
    url: 'https://example.com/job',
    snippet: 'Job',
  }, 'text'));
});
