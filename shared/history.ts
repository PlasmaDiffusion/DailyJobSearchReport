/** Validates and manages browser-saved tabs, reports, applications, and backups. */
import { z } from 'zod';
import { configSchema } from '../server/config.js';


export const DAYS_30 = 30 * 86400000;
const date = z.iso.datetime({ offset: true });
const url = z.url().refine(
  (value) => ['http:', 'https:'].includes(new URL(value).protocol),
  'Only HTTP(S) links are allowed',
);
const text = z.string().max(30000);

export const jobSchema = z.object({
  title: text,
  company: text,
  url,
  summary: text.default(''),
  fitScore: z.number().min(0).max(100).nullable().default(null),
  keyGaps: z.array(text).max(100).default([]),
  missingKeywords: z.array(text).max(100).default([]),
  resumeMatch: text.default(''),
});

const application = jobSchema.extend({ appliedAt: date });
export const reportSchema = z.object({
  id: z.uuid(),
  tabId: z.uuid(),
  createdAt: date,
  status: z.literal('completed'),
  results: z.array(jobSchema).max(20),
  warnings: z.array(text).max(20).default([]),
});

const tabSchema = z.object({ id: z.uuid(), config: configSchema });
export const backupSchema = z.object({
  version: z.literal(2),
  tabs: z.array(tabSchema),
  reports: z.array(reportSchema),
  applications: z.array(application),
}).superRefine((data, context) => {
  const addDuplicateIssue = (key: string, values: string[]) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: 'custom', path: [key], message: 'Duplicate records in backup' });
    }
  };

  addDuplicateIssue('tabs', data.tabs.map((item) => item.id));
  addDuplicateIssue('reports', data.reports.map((item) => item.id));
  addDuplicateIssue('applications', data.applications.map((item) => item.url));
});

export type Job = z.infer<typeof jobSchema>;
export type Report = z.infer<typeof reportSchema>;
export type Backup = z.infer<typeof backupSchema>;
export type HistoryEntry = {
  title: string;
  company: string;
  url: string;
  recordedAt: string;
};

export const emptyState = (): Backup => ({
  version: 2,
  tabs: [],
  reports: [],
  applications: [],
});

/** Merge a validated backup while keeping records already present locally. */
export function mergeBackup(current: Backup, incoming: unknown): Backup {
  const parsed = backupSchema.parse(incoming);
  const merge = <Item>(existing: Item[], added: Item[], key: (item: Item) => string): Item[] => [
    ...existing,
    ...added.filter((item) => !existing.some((old) => key(old) === key(item))),
  ];

  return backupSchema.parse({
    version: 2,
    tabs: merge(current.tabs, parsed.tabs, (item) => item.id),
    reports: merge(current.reports, parsed.reports, (item) => item.id),
    applications: merge(current.applications, parsed.applications, (item) => item.url),
  });
}

/** Collect recent shown and applied jobs to exclude from a new search. */
export function recentHistory(state: Backup, tabId: string, now = Date.now()): HistoryEntry[] {
  const cutoff = now - DAYS_30;
  const isRecent = (value: string) => Date.parse(value) > cutoff && Date.parse(value) <= now;
  const shownJobs = state.reports
    .filter((report) => report.tabId === tabId && isRecent(report.createdAt))
    .flatMap((report) => report.results.map((job) => ({
      title: job.title,
      company: job.company,
      url: job.url,
      recordedAt: report.createdAt,
    })));
  const appliedJobs = state.applications
    .filter((job) => isRecent(job.appliedAt))
    .map((job) => ({
      title: job.title,
      company: job.company,
      url: job.url,
      recordedAt: job.appliedAt,
    }));

  return [...shownJobs, ...appliedJobs]
    .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt))
    .slice(-2000);
}

/** Remove reports outside the 30-day retention window. */
export function pruneReports(state: Backup, now = Date.now()): Backup {
  return {
    ...state,
    reports: state.reports.filter((report) => Date.parse(report.createdAt) > now - DAYS_30),
  };
}

/** Load current browser data or migrate records saved by the legacy app. */
export function loadState(storage: Pick<Storage, 'getItem'>): Backup {
  const raw = storage.getItem('djs.state');
  if (raw) return backupSchema.parse(JSON.parse(raw));

  const tabs = (JSON.parse(storage.getItem('djs.tabs') || '[]') as Array<{
    code: string;
    config: z.input<typeof configSchema>;
  }>)
    .map((tab) => ({ id: tab.code, config: tab.config }));
  const reports = (JSON.parse(storage.getItem('djs.reports') || '[]') as Array<{
    id: string;
    code: string;
    created_at: string;
    results: Job[];
    warnings?: string[];
  }>)
    .map((report) => ({
      id: report.id,
      tabId: report.code,
      createdAt: report.created_at,
      status: 'completed',
      results: report.results,
      warnings: report.warnings || [],
    }));

  return backupSchema.parse({ version: 2, tabs, reports, applications: [] });
}
