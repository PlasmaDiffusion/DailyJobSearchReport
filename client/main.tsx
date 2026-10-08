/** Renders the search form, report history, and local backup controls. */
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { configSchema } from '../server/config.js';
import type { SearchConfig } from '../server/config.js';
import {
  backupSchema,
  emptyState,
  loadState,
  mergeBackup,
  recentHistory,
  pruneReports,
} from '../shared/history.js';
import type { Backup, Report } from '../shared/history.js';
import { search } from './search.js';
import './style.css';

const blank = (): SearchConfig => ({
  title: 'New search',
  mode: 'jobs',
  companies: [],
  roles: [],
  skills: [],
  locations: [],
  strictCompany: false,
  strictRole: false,
  strictSkills: false,
  resume: '',
  prompt: '',
  limit: 10,
});

/** Owns the active search tab and persists reports in browser storage. */
function App() {
  const [state, setState] = useState<Backup>(emptyState());
  const [active, setActive] = useState<string | undefined>(undefined);
  const [form, setForm] = useState<SearchConfig>(blank());
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState<{
    message: string;
    current?: number;
    total?: number;
  } | undefined>(undefined);
  const [usage, setUsage] = useState(0);
  const [prune, setPrune] = useState(false);
  const [remove, setRemove] = useState(false);
  const [unsaved, setUnsaved] = useState<Report | undefined>(undefined);
  const abort = useRef<AbortController | undefined>(undefined);
  const importFile = useRef<HTMLInputElement>(null);

  function updateUsage() {
    try {
      let bytes = 0;
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key === null) continue;
        bytes += (key.length + (localStorage.getItem(key) || '').length) * 2;
      }
      setUsage(bytes);
    } catch {
      // Storage usage is a convenience indicator; ignore unavailable storage.
    }
  }

  useEffect(() => {
    try {
      const initial = loadState(localStorage);
      setState(initial);
      setActive(initial.tabs[0]?.id);
      setForm(initial.tabs[0]?.config || blank());
    } catch {
      setNotice('Saved browser data could not be read. Import a valid backup to recover your data.');
    }

    setReady(true);
    updateUsage();
    return () => abort.current?.abort();
  }, []);

  // Validate each saved state before replacing the browser's current data.
  function persist(next: Backup): Backup | null {
    try {
      const checked = backupSchema.parse(next);
      localStorage.setItem('djs.state', JSON.stringify(checked));

      try {
        localStorage.removeItem('djs.tabs');
        localStorage.removeItem('djs.reports');
      } catch {
        // Legacy keys are harmless if they cannot be removed.
      }

      setState(checked);
      updateUsage();
      return checked;
    } catch (error: any) {
      const message = error.name === 'ZodError'
        ? 'Data limits exceeded. Export a backup and remove older reports.'
        : 'Browser storage is full or unavailable. Export your data before removing older reports.';
      setNotice(message);
      return null;
    }
  }

  // Validate the form and save it into the active tab, creating a tab if needed.
  function save(): { id: string; config: SearchConfig; saved: Backup } {
    const config = configSchema.parse({
      ...form,
      companies: form.companies.filter((item) => item.trim()),
      roles: form.roles.filter((item) => item.trim()),
      skills: form.skills.filter((item) => item.trim()),
      locations: form.locations.filter((item) => item.trim()),
    });
    const id = active || crypto.randomUUID();
    const tabs = active
      ? state.tabs.map((tab) => (tab.id === id ? { id, config } : tab))
      : [...state.tabs, { id, config }];
    const saved = persist({ ...state, tabs });

    if (!saved) throw new Error('Could not save search settings');
    setActive(id);
    return { id, config, saved };
  }

  // Switch the visible form to a saved tab or a blank new tab.
  function select(tab?: Backup['tabs'][number]) {
    setActive(tab?.id);
    setForm(tab?.config || blank());
    setProgress(undefined);
    setNotice('');
    setUnsaved(undefined);
  }

  // Include a completed report that could not fit in local storage in the export.
  function exportData() {
    const data = unsaved
      ? { ...state, reports: [...state.reports.filter((report) => report.id !== unsaved.id), unsaved] }
      : state;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'daily-job-search-backup.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Validate and merge a selected backup, reporting any import errors.
  async function importData(file?: File) {
    if (!file) return;

    setBusy(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Backup must be smaller than 5 MB');
      const incoming = JSON.parse(await file.text());
      const next = mergeBackup(state, incoming);

      if (persist(next)) {
        if (!active) select(next.tabs[0]);
        setNotice('Backup imported. Existing records were kept; new records were added.');
      }
    } catch (error: any) {
      setNotice(error.name === 'ZodError' ? 'Invalid backup. Nothing was imported.' : error.message);
    } finally {
      if (importFile.current) importFile.current.value = '';
      setBusy(false);
    }
  }

  // Save the current settings, stream a report, and persist it when complete.
  async function run() {
    setBusy(true);
    setNotice('');
    setProgress(undefined);
    setUnsaved(undefined);

    const controller = new AbortController();
    abort.current = controller;

    try {
      const { id, config, saved } = save();
      const report = await search(
        { tabId: id, config, history: recentHistory(saved, id) },
        setProgress,
        controller.signal,
      );

      if (persist({ ...saved, reports: [...saved.reports, report] })) {
        setNotice('Report complete and saved in this browser.');
      } else {
        setUnsaved(report);
      }
    } catch (error: any) {
      const message = controller.signal.aborted
        ? 'Search cancelled. No report was saved.'
        : error.issues?.map((issue: { message: string }) => issue.message).join('; ') || error.message;
      setNotice(message);
    } finally {
      setBusy(false);
      setProgress(undefined);
      abort.current = undefined;
    }
  }

  function change<Key extends keyof SearchConfig>(key: Key, value: SearchConfig[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleApplied(job: Report['results'][number]) {
    const exists = state.applications.some((application) => application.url === job.url);
    const applications = exists
      ? state.applications.filter((application) => application.url !== job.url)
      : [...state.applications, { ...job, appliedAt: new Date().toISOString() }];
    persist({ ...state, applications });
  }

  const reports = [
    ...state.reports.filter((report) => report.tabId === active),
    ...(unsaved ? [unsaved] : []),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return (
    <div className="min-h-screen bg-slate-950 pb-28 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-teal-300">Your next opportunity</p>
            <h1 className="text-xl font-semibold">Daily Job Search Report</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <span>Browser storage: {(usage / 1024).toFixed(1)} KB</span>
            <button disabled={busy || !ready} onClick={exportData}>Export JSON</button>
            <button disabled={busy || !ready} onClick={() => importFile.current?.click()}>
              Import JSON
            </button>
            <input
              ref={importFile}
              className="hidden"
              type="file"
              accept="application/json,.json"
              aria-label="Import JSON backup"
              onChange={(event) => importData(event.target.files?.[0] || undefined)}
            />
            <button disabled={busy} onClick={() => setPrune(true)}>
              Delete reports 30+ days old
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6">
        {notice && (
          <p role="status" className="mb-5 rounded bg-amber-950 p-4 text-amber-100">
            {notice}
          </p>
        )}

        {progress && (
          <div role="status" aria-live="polite" className="panel mb-5">
            <p className="text-teal-300">
              {progress.message}
              {progress.total ? ` (${progress.current}/${progress.total})` : ''}
            </p>
            <button onClick={() => abort.current?.abort()}>Cancel search</button>
          </div>
        )}

        <section className="panel">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">Shape your search</h2>
              <p className="mt-1 text-slate-400">
                Search when you’re ready. Your settings and reports stay in this browser.
              </p>
            </div>
            <button disabled={busy || !ready} onClick={run}>
              {busy ? 'Searching…' : 'Search now'}
            </button>
          </div>

          <fieldset disabled={busy || !ready} className="mt-6">
            <div className="grid gap-5 md:grid-cols-2">
              <label>
                Tab title
                <input value={form.title} onChange={(event) => change('title', event.target.value)} />
              </label>
              <div>
                <span className="label">Search mode</span>
                <div className="flex gap-6 py-3">
                  {(['jobs', 'news'] as const).map((mode) => (
                    <label key={mode} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="mode"
                        checked={form.mode === mode}
                        onChange={() => change('mode', mode)}
                      />
                      {mode === 'jobs' ? 'Jobs' : 'Tech news'}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {form.mode === 'jobs' ? (
              <>
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  {([
                    ['companies', 'Companies'],
                    ['roles', 'Job titles'],
                    ['skills', 'Key skills'],
                    ['locations', 'Locations'],
                  ] as const).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        value={form[key].join(',')}
                        placeholder="Separate entries with commas"
                        onChange={(event) => change(
                          key,
                          event.target.value.split(',').map((item) => item.trim()),
                        )}
                      />
                    </label>
                  ))}
                </div>

                <div className="my-5 flex flex-wrap gap-6">
                  {([
                    ['strictCompany', 'Require a listed company'],
                    ['strictRole', 'Require a listed title'],
                    ['strictSkills', 'Require all listed skills'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form[key]}
                        onChange={(event) => change(key, event.target.checked)}
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <label>
                  Resume text
                  <textarea
                    rows={6}
                    value={form.resume}
                    onChange={(event) => change('resume', event.target.value)}
                    placeholder="Paste your resume for fit scores and ATS keyword suggestions"
                  />
                </label>
                <p className="mt-2 text-xs text-slate-400">
                  Saved locally and sent through the backend to OpenAI when you search.
                  Your JSON backup includes your resume.
                </p>
              </>
            ) : (
              <label className="mt-5 block">
                News search prompt
                <textarea
                  rows={4}
                  value={form.prompt}
                  onChange={(event) => change('prompt', event.target.value)}
                  placeholder="New technologies for software developers, or industry trends…"
                />
              </label>
            )}

            <div className="mt-5 flex flex-wrap items-end gap-6">
              <label>
                Results to search (1–20)
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={form.limit}
                  onChange={(event) => change('limit', Number(event.target.value))}
                />
              </label>
              <button
                onClick={() => {
                  try {
                    save();
                    setNotice('Search settings saved locally.');
    } catch (error: any) {
                    setNotice(error.issues?.map((issue: { message: string }) => issue.message).join('; ') || error.message);
                  }
                }}
              >
                Save settings
              </button>
              {active && <button onClick={() => setRemove(true)}>Delete tab</button>}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Jobs shown in this tab or marked as applied within the last 30 days are excluded.
              Strict filters may return fewer results than requested.
            </p>
          </fieldset>
        </section>

        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">Your reports</h2>
          {!reports.length && (
            <div className="panel text-slate-400">Your report will appear here after you search.</div>
          )}
          {reports.map((report) => (
            <article className="panel mb-4" key={report.id}>
              <div className="mb-4">
                <h3 className="font-semibold">{new Date(report.createdAt).toLocaleString()}</h3>
                <p className="text-sm text-slate-400">
                  {report.results.length} results
                  {report === unsaved ? ' · Not saved — export to keep it' : ''}
                </p>
              </div>
              {report.warnings.map((warning, index) => (
                <p key={index} className="mb-2 text-xs text-amber-200">{warning}</p>
              ))}
              {report.results.map((result, index) => (
                <div key={index} className="border-t border-slate-700 py-4">
                  <div className="flex justify-between gap-4">
                    <a
                      className="font-medium text-teal-300"
                      href={result.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {result.title}{result.company && ` · ${result.company}`} ↗
                    </a>
                    {result.fitScore !== null && (
                      <span className="whitespace-nowrap text-teal-200">
                        {result.fitScore}% fit
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-slate-300">{result.summary}</p>
                  {result.resumeMatch && (
                    <p className="mt-2 text-sm text-slate-400">{result.resumeMatch}</p>
                  )}
                  {result.keyGaps.length > 0 && (
                    <p className="mt-2 text-sm">Gaps: {result.keyGaps.join(', ')}</p>
                  )}
                  {result.missingKeywords.length > 0 && (
                    <p className="mt-2 text-sm">ATS keywords: {result.missingKeywords.join(', ')}</p>
                  )}
                  {state.tabs.find((tab) => tab.id === report.tabId)?.config.mode !== 'news' && (
                    <button
                      className="mt-3"
                      disabled={busy}
                      onClick={() => toggleApplied(result)}
                    >
                      {state.applications.some((job) => job.url === result.url)
                        ? 'Applied — undo'
                        : 'Mark as applied'}
                    </button>
                  )}
                </div>
              ))}
            </article>
          ))}
        </section>

        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">Application history</h2>
          {!state.applications.length ? (
            <p className="text-slate-400">Use “Mark as applied” after submitting an application.</p>
          ) : (
            state.applications.map((job) => (
              <div
                className="panel mb-3 flex flex-wrap justify-between gap-3"
                key={job.url}
              >
                <div>
                  <a className="text-teal-300" href={job.url} target="_blank" rel="noreferrer">
                    {job.title} · {job.company}
                  </a>
                  <p className="text-sm text-slate-400">
                    Applied {new Date(job.appliedAt).toLocaleDateString()}
                  </p>
                </div>
                <button disabled={busy} onClick={() => toggleApplied(job)}>Undo applied</button>
              </div>
            ))
          )}
        </section>
      </main>

      <nav
        aria-label="Search tabs"
        className="fixed inset-x-0 bottom-0 flex gap-2 overflow-x-auto border-t border-slate-700 bg-slate-900 p-3"
      >
        {state.tabs.map((tab) => (
          <button
            disabled={busy}
            aria-current={tab.id === active ? 'page' : undefined}
            className={tab.id === active ? 'active' : ''}
            key={tab.id}
            onClick={() => select(tab)}
          >
            {tab.config.title}
          </button>
        ))}
        <button disabled={busy || !ready} onClick={() => select()}>+ New tab</button>
      </nav>

      {(prune || remove) && (
        <div className="fixed inset-0 grid place-items-center bg-black/70 p-6">
          <section role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="panel max-w-md">
            <h2 id="dialog-title" className="text-xl">
              {prune ? 'Delete older saved reports?' : 'Delete this tab and its reports?'}
            </h2>
            <p className="my-4 text-slate-300">
              {prune
                ? 'Remove reports created 30 or more days ago. Application history and tabs are kept.'
                : 'This removes the tab and its reports from this browser. Application history is kept.'}
            </p>
            <button
              onClick={() => {
                if (prune) {
                  persist(pruneReports(state));
                  setPrune(false);
                } else {
                  const next = {
                    ...state,
                    tabs: state.tabs.filter((tab) => tab.id !== active),
                    reports: state.reports.filter((report) => report.tabId !== active),
                  };
                  if (persist(next)) select(next.tabs[0]);
                  setRemove(false);
                }
              }}
            >
              Delete
            </button>
            <button onClick={() => { setPrune(false); setRemove(false); }}>Cancel</button>
          </section>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="*" element={<App />} />
    </Routes>
  </BrowserRouter>,
);
