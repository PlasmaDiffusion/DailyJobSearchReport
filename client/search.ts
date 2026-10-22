/** Sends a search request and reads progress and report events from its stream. */
import { reportSchema } from '../shared/history.js';
import type { SearchConfig } from '../server/config.js';

type SearchRequest = {
  tabId: string;
  config: SearchConfig;
  history: Array<{
    title: string;
    company: string;
    url: string;
    recordedAt: string;
  }>;
};
type ProgressEvent = {
  type: 'progress';
  stage: string;
  message: string;
  current?: number;
  total?: number;
};

/** Request a report, forward progress events, and validate the completed result. */
export async function search(
  input: SearchRequest,
  onProgress: (event: ProgressEvent) => void,
  signal?: AbortSignal,
) {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });

  if (!response.ok) {
    const error = await response.json();
    const details = error.details?.map((issue: { message: string }) => issue.message).join('; ');
    throw new Error(details || error.error || 'Search request failed');
  }
  if (!response.body) throw new Error('Streaming is unavailable');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let report;

  // Process one newline-delimited event without assuming network chunk boundaries.
  const consume = (line: string) => {
    if (!line.trim()) return;

    const event = JSON.parse(line);
    if (event.type === 'error') throw new Error(event.message);
    if (event.type === 'progress') onProgress(event);
    if (event.type === 'complete') report = reportSchema.parse(event.report);
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      let end;
      while ((end = buffer.indexOf('\n')) !== -1) {
        consume(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
      }

      if (done) break;
    }

    consume(buffer);
    if (!report) throw new Error('Search connection ended before the report was complete');
    return report;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
