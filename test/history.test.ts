/** Covers backup validation, migration, history filtering, and report pruning. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  backupSchema,
  mergeBackup,
  recentHistory,
  pruneReports,
  loadState,
} from '../shared/history.js';

const id = '159f4603-eaee-47c4-bd9a-a43308e80545';
const reportId = '159f4603-eaee-47c4-bd9a-a43308e80546';
const now = Date.parse('2026-10-08T00:00:00Z');
const recent = new Date(now - 86400000).toISOString();
const old = new Date(now - 31 * 86400000).toISOString();
const job = {
  title: 'Engineer',
  company: 'Acme',
  url: 'https://example.com/job',
  summary: 'Job',
  fitScore: null,
  keyGaps: [],
  missingKeywords: [],
  resumeMatch: '',
};

const state = () => ({
  version: 2,
  tabs: [{ id, config: { title: 'Jobs', roles: ['Engineer'], resume: 'My resume' } }],
  reports: [{
    id: reportId,
    tabId: id,
    createdAt: recent,
    status: 'completed',
    results: [job],
    warnings: [],
  }],
  applications: [{ ...job, url: 'https://example.com/applied', appliedAt: recent }],
});

test('JSON roundtrip preserves tabs, resumes, reports and separate applications', () => {
  const parsed = backupSchema.parse(state());
  const roundtrip = backupSchema.parse(JSON.parse(JSON.stringify(parsed)));

  assert.deepEqual(roundtrip, parsed);
  assert.equal(parsed.applications.length, 1);
});

test('import merges records without duplicating or overwriting existing tabs', () => {
  const current = backupSchema.parse(state());
  const incoming = state();
  incoming.tabs[0].config.title = 'Incoming title';

  const merged = mergeBackup(current, incoming);
  assert.equal(merged.tabs.length, 1);
  assert.equal(merged.tabs[0].config.title, 'Jobs');
  assert.equal(merged.reports.length, 1);
});

test('unsafe links and unsupported backup versions are rejected', () => {
  const bad = state();
  bad.reports[0].results[0] = { ...job, url: 'javascript:alert(1)' };

  assert.throws(() => backupSchema.parse(bad));
  assert.throws(() => mergeBackup(backupSchema.parse(state()), { ...state(), version: 1 }));
});

test('only recent shown and applied jobs enter history; pruning keeps applications', () => {
  const saved = backupSchema.parse(state());
  saved.reports.push({
    ...saved.reports[0],
    id: '159f4603-eaee-47c4-bd9a-a43308e80547',
    createdAt: old,
  });

  assert.equal(recentHistory(saved, id, now).length, 2);

  const pruned = pruneReports(saved, now);
  assert.equal(pruned.reports.length, 1);
  assert.equal(pruned.applications.length, 1);
});

test('legacy local tabs and saved reports migrate without backend reads', () => {
  const saved = state();
  const values: Record<string, string> = {
    'djs.tabs': JSON.stringify(saved.tabs.map((tab) => ({
      code: tab.id,
      config: { ...tab.config, enabled: true },
    }))),
    'djs.reports': JSON.stringify(saved.reports.map((report) => ({
      ...report,
      code: report.tabId,
      created_at: report.createdAt,
    }))),
  };

  const loaded = loadState({ getItem: (key: string) => values[key] || null });
  assert.equal(loaded.tabs[0].id, id);
  assert.equal(loaded.reports[0].tabId, id);
  assert.ok(!('enabled' in loaded.tabs[0].config));
});

test('duplicate IDs in imported backup are rejected', () => {
  const bad = state();
  bad.tabs.push(bad.tabs[0]);

  assert.throws(() => backupSchema.parse(bad));
});
