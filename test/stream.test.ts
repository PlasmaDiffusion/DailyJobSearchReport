/** Checks browser decoding and error handling for streamed search events. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { search } from '../client/search.js';
import { configSchema } from '../server/config.js';

const report = {
  id: '159f4603-eaee-47c4-bd9a-a43308e80546',
  tabId: '159f4603-eaee-47c4-bd9a-a43308e80545',
  createdAt: new Date().toISOString(),
  status: 'completed',
  results: [],
  warnings: [],
};
const input = {
  tabId: report.tabId,
  config: configSchema.parse({ title: 'Jobs', roles: ['Engineer'] }),
  history: [],
};

test('client decodes split UTF-8 progress and completed report chunks', async (t) => {
  const bytes = new TextEncoder().encode(
    `${JSON.stringify({ type: 'progress', stage: 'searching', message: 'Searching…' })}\n`
      + `${JSON.stringify({ type: 'complete', report })}\n`,
  );
  t.mock.method(global, 'fetch', async () => new Response(new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    },
  })));

  const progress: Array<{ message: string }> = [];
  assert.deepEqual(await search(input, (event) => progress.push(event)), report);
  assert.equal(progress[0].message, 'Searching…');
});

test('client fails on stream errors and premature termination', async (t) => {
  const mocked = t.mock.method(
    global,
    'fetch',
    async () => new Response('{"type":"error","message":"Failed"}\n'),
  );

  await assert.rejects(search(input, () => {}), /Failed/);

  mocked.mock.mockImplementation(async () => new Response(
    '{"type":"progress","message":"Searching"}\n',
  ));
  await assert.rejects(search(input, () => {}), /before the report was complete/);
});
