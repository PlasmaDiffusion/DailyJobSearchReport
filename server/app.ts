/** Defines the HTTP API, including validation and streamed search responses. */
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { requestSchema } from './runner.js';

/** Build the Express app around a search runner, allowing tests to inject one. */
type SearchRunner = (
  input: z.infer<typeof requestSchema>,
  emit: (event: any) => void,
  signal: AbortSignal,
) => Promise<unknown>;

export function createApp(run: SearchRunner) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.post('/api/search', async (req, res) => {
    const input = requestSchema.parse(req.body);
    const controller = new AbortController();
    const abort = () => {
      if (!res.writableEnded) controller.abort();
    };

    res.on('close', abort);
    res.set({
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const emit = (event: any) => {
      if (!res.destroyed) res.write(`${JSON.stringify(event)}\n`);
    };
    const heartbeat = setInterval(() => emit({ type: 'heartbeat' }), 15000);
    heartbeat.unref();

    try {
      const report = await run(input, emit, controller.signal);
      emit({ type: 'complete', report });
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('Search failed:', error instanceof Error ? error.message : String(error));
        emit({
          type: 'error',
          message: 'Search failed. Check provider credentials and try again.',
        });
      }
    } finally {
      clearInterval(heartbeat);
      res.off('close', abort);
      res.end();
    }
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found' }));
  const handleError: ErrorRequestHandler = (error, req, res, next) => {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid search request', details: error.issues });
    }
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });

    console.error(error.message);
    return res.status(500).json({ error: 'Request failed' });
  };
  app.use(handleError);

  return app;
}
