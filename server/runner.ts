/** Orchestrates provider calls, progress events, filtering, and report creation. */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pairKey, strictMatch, configSchema, type SearchConfig } from './config.js';
import type { Job } from '../shared/history.js';

type SearchItem = { title: string; url: string; snippet: string };
type Evaluation = Omit<Job, 'url'>;
type RunnerProviders = {
  search(config: SearchConfig, signal?: AbortSignal): Promise<SearchItem[]>;
  scrape(url: string, signal?: AbortSignal): Promise<string | null>;
  evaluate(
    config: SearchConfig,
    item: SearchItem,
    text: string,
    signal?: AbortSignal,
  ): Promise<Evaluation>;
};
type ProgressEvent = {
  type: 'progress';
  stage: 'searching' | 'scraping' | 'generating';
  message: string;
  current?: number;
  total?: number;
};

export const requestSchema = z.object({
  tabId: z.uuid(),
  config: configSchema,
  history: z.array(z.object({
    title: z.string().max(30000),
    company: z.string().max(30000),
    url: z.url().max(4000),
    recordedAt: z.iso.datetime({ offset: true }),
  })).max(2000).default([]),
});

/** Create a search runner using the supplied provider adapters. */
export function makeRunner(providers: RunnerProviders) {
  return async (
    { tabId, config, history }: z.infer<typeof requestSchema>,
    emit: (event: ProgressEvent) => void = () => {},
    signal?: AbortSignal,
  ) => {
    const checkpoint = () => signal?.throwIfAborted();
    checkpoint();

    const now = Date.now();
    const recent = history.filter((record) => {
      const recordedAt = Date.parse(record.recordedAt);
      return recordedAt > now - 30 * 86400000 && recordedAt <= now;
    });
    const urls = new Set(recent.map((record) => record.url));
    const pairs = new Set(recent.map(pairKey));
    const results = [];
    const warnings = [];

    emit({
      type: 'progress',
      stage: 'searching',
      message: `Searching with ${process.env.SEARCH_PROVIDER === 'firecrawl' ? 'Firecrawl' : 'SerpApi'}…`,
    });

    const candidates = await providers.search(config, signal);
    checkpoint();
    const items = candidates.slice(0, config.limit);

    for (const [index, item] of items.entries()) {
      checkpoint();

      let url;
      try {
        url = new URL(item.url);
      } catch {
        continue;
      }

      if (!['http:', 'https:'].includes(url.protocol) || urls.has(item.url)) continue;

      let text = item.snippet;
      emit({
        type: 'progress',
        stage: 'scraping',
        message: process.env.FIRECRAWL_API_KEY
          ? 'Reading postings with Firecrawl…'
          : 'Using search snippets (Firecrawl is not configured)…',
        current: index + 1,
        total: items.length,
      });

      try {
        text = (await providers.scrape(item.url, signal)) || text;
      } catch {
        checkpoint();
        warnings.push(`Could not scrape ${item.url}; evaluated its search snippet.`);
      }

      checkpoint();
      emit({
        type: 'progress',
        stage: 'generating',
        message: 'Generating your report with OpenAI…',
        current: index + 1,
        total: items.length,
      });

      const result = {
        ...await providers.evaluate(config, item, text, signal),
        url: item.url,
      };
      checkpoint();

      if (config.mode === 'jobs') {
        const searchableText = [result.title, result.company, text].join(' ');
        if (!strictMatch(config, result, searchableText) || pairs.has(pairKey(result))) continue;
      }

      results.push(result);
      urls.add(result.url);
      pairs.add(pairKey(result));
    }

    checkpoint();
    return {
      id: randomUUID(),
      tabId,
      createdAt: new Date().toISOString(),
      status: 'completed',
      results,
      warnings,
    };
  };
}
