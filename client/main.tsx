/** Composes the search workspace and coordinates local state and persistence. */
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { configSchema } from '../server/config.js';
import type { SearchConfig } from '../server/config.js';
import {
  backupSchema,
  emptyState,
  loadState,
  mergeBackup,
  pruneReports,
  recentHistory,
} from '../shared/history.js';
import type { Backup, Report } from '../shared/history.js';
import { BackupActions } from './components/BackupActions.js';
import { ApplicationHistory } from './components/ApplicationHistory.js';
import { JobSearchForm } from './components/JobSearchForm.js';
import { JobSearchReport } from './components/JobSearchReport.js';
import { JobSearchTabsRow } from './components/JobSearchTabsRow.js';
import { Button } from './components/common/Button.js';
import { DEFAULT_PICKER_COLOR } from './components/common/ColorPicker.js';
import { Modal } from './components/common/Modal.js';
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
function App() {
  const [state, setState] = useState<Backup>(emptyState());
  const [activeId, setActiveId] = useState<string>();
  const [form, setForm] = useState<SearchConfig>(blank());
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState<{ message: string; current?: number; total?: number }>();
  const [usage, setUsage] = useState(0);
  const [draftColor, setDraftColor] = useState(DEFAULT_PICKER_COLOR);
  const [confirmAction, setConfirmAction] = useState<'prune' | 'remove-tab'>();
  const [showApplications, setShowApplications] = useState(false);
  const [unsaved, setUnsaved] = useState<Report>();
  const abort = useRef<AbortController | undefined>(undefined);

  function updateUsage() {
    try {
      let bytes = 0;
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key !== null) bytes += (key.length + (localStorage.getItem(key) || '').length) * 2;
      }
      setUsage(bytes);
    } catch {
      // Storage usage is only a convenience indicator.
    }
  }

  useEffect(() => {
    try {
      const initial = loadState(localStorage);
      setState(initial);
      setActiveId(initial.tabs[0]?.id);
      setForm(initial.tabs[0]?.config || blank());
      setDraftColor(initial.tabs[0]?.color || DEFAULT_PICKER_COLOR);
    } catch {
      setNotice('Saved browser data could not be read. Import a valid backup to recover your data.');
    }

    setReady(true);
    updateUsage();
    return () => abort.current?.abort();
  }, []);

  function persist(next: Backup): Backup | null {
    try {
      const checked = backupSchema.parse(next);
      localStorage.setItem('djs.state', JSON.stringify(checked));
      try {
        localStorage.removeItem('djs.tabs');
        localStorage.removeItem('djs.reports');
      } catch {
        // Legacy keys can stay if the browser blocks their removal.
      }
      setState(checked);
      updateUsage();
      return checked;
    } catch (error: any) {
      setNotice(error.name === 'ZodError'
        ? 'Data limits exceeded. Export a backup and remove older reports.'
        : 'Browser storage is full or unavailable. Export your data before removing older reports.');
      return null;
    }
  }

  function updateField<Key extends keyof SearchConfig>(key: Key, value: SearchConfig[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validatedConfig(): SearchConfig {
    return configSchema.parse({
      ...form,
      companies: form.companies.filter((item) => item.trim()),
      roles: form.roles.filter((item) => item.trim()),
      skills: form.skills.filter((item) => item.trim()),
      locations: form.locations.filter((item) => item.trim()),
    });
  }

  function selectTab(tab?: Backup['tabs'][number]) {
    setActiveId(tab?.id);
    setForm(tab?.config || blank());
    setDraftColor(tab?.color || DEFAULT_PICKER_COLOR);
    setProgress(undefined);
    setNotice('');
    setUnsaved(undefined);
  }

  // Each explicit save creates a new named search tab from the current form.
  function saveSettings() {
    try {
      const config = validatedConfig();
      const tab = { id: crypto.randomUUID(), config, color: draftColor };
      const saved = persist({ ...state, tabs: [...state.tabs, tab] });
      if (!saved) return;

      setActiveId(tab.id);
      setForm(config);
      setNotice(`Saved “${config.title}” as a new search tab.`);
    } catch (error: any) {
      setNotice(error.issues?.map((issue: { message: string }) => issue.message).join('; ') || error.message);
    }
  }

  // Search the active tab's edited settings, creating a tab when starting a new search.
  function saveForSearch(): { id: string; config: SearchConfig; saved: Backup } {
    const config = validatedConfig();
    const id = activeId || crypto.randomUUID();
    const tabs = activeId
      ? state.tabs.map((tab) => (tab.id === id ? { ...tab, config } : tab))
      : [...state.tabs, { id, config, color: draftColor }];
    const saved = persist({ ...state, tabs });

    if (!saved) throw new Error('Could not save search settings');
    setActiveId(id);
    return { id, config, saved };
  }

  async function runSearch() {
    setBusy(true);
    setNotice('');
    setProgress(undefined);
    setUnsaved(undefined);
    const controller = new AbortController();
    abort.current = controller;

    try {
      const { id, config, saved } = saveForSearch();
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

  async function importData(file: File) {
    setBusy(true);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Backup must be smaller than 5 MB');
      const incoming = JSON.parse(await file.text());
      const next = mergeBackup(state, incoming);
      if (persist(next)) {
        if (!activeId) selectTab(next.tabs[0]);
        setNotice('Backup imported. Existing records were kept; new records were added.');
      }
    } catch (error: any) {
      setNotice(error.name === 'ZodError' ? 'Invalid backup. Nothing was imported.' : error.message);
    } finally {
      setBusy(false);
    }
  }

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

  function toggleApplied(result: Report['results'][number]) {
    const exists = state.applications.some((application) => application.url === result.url);
    const applications = exists
      ? state.applications.filter((application) => application.url !== result.url)
      : [...state.applications, { ...result, appliedAt: new Date().toISOString() }];
    persist({ ...state, applications });
  }

  function updateTabColor(color: string) {
    setDraftColor(color);
    if (!activeId) return;

    const tabs = state.tabs.map((tab) => (
      tab.id === activeId ? { ...tab, color } : tab
    ));
    persist({ ...state, tabs });
  }

  function confirmDelete() {
    if (confirmAction === 'prune') {
      persist(pruneReports(state));
    } else if (confirmAction === 'remove-tab') {
      const next = {
        ...state,
        tabs: state.tabs.filter((tab) => tab.id !== activeId),
        reports: state.reports.filter((report) => report.tabId !== activeId),
      };
      if (persist(next)) selectTab(next.tabs[0]);
    }
    setConfirmAction(undefined);
  }

  const activeTab = state.tabs.find((tab) => tab.id === activeId);
  const reports = [
    ...state.reports.filter((report) => report.tabId === activeId),
    ...(unsaved ? [unsaved] : []),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const appliedUrls = new Set(state.applications.map((application) => application.url));

  return (
    <main
      className="app-shell"
      style={{ '--workspace-accent': draftColor } as React.CSSProperties}
    >
      <section className="workspace-frame">
        <header className="workspace-toolbar">
          <div className="brand-mark" aria-hidden="true">D</div>
          <div className="toolbar-title">
            <span>DAILY JOB SEARCH</span>
            <strong>Opportunity finder</strong>
          </div>
          <BackupActions
            usageBytes={usage}
            busy={busy}
            ready={ready}
            onExport={exportData}
            onImport={importData}
            onPrune={() => setConfirmAction('prune')}
            onShowApplications={() => setShowApplications(true)}
          />
        </header>

        {(notice || progress) && (
          <div className={`workspace-notice${progress ? ' workspace-notice--progress' : ''}`} role="status">
            <span>{progress?.message || notice}</span>
            {progress?.total && <span>{progress.current}/{progress.total}</span>}
            {progress && <Button onClick={() => abort.current?.abort()}>Cancel search</Button>}
          </div>
        )}

        <div className="workspace-columns">
          <JobSearchForm
            config={form}
            disabled={busy || !ready}
            onChange={updateField}
            onSave={saveSettings}
            onSearch={runSearch}
            accentColor={draftColor}
            onAccentColorChange={updateTabColor}
            onDeleteTab={activeId ? () => setConfirmAction('remove-tab') : undefined}
          />
          <JobSearchReport
            reports={reports}
            mode={activeTab?.config.mode || form.mode}
            appliedUrls={appliedUrls}
            onToggleApplied={toggleApplied}
          />
        </div>

        <JobSearchTabsRow
          tabs={state.tabs}
          activeId={activeId}
          disabled={busy || !ready}
          onSelect={selectTab}
          onNewTab={() => selectTab()}
        />
      </section>

      {confirmAction && (
        <Modal
          title={confirmAction === 'prune' ? 'Delete older saved reports?' : 'Delete this tab and its reports?'}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setConfirmAction(undefined)}
        >
          {confirmAction === 'prune'
            ? 'Remove reports created 30 or more days ago. Application history and tabs are kept.'
            : 'This removes the tab and its reports from this browser. Application history is kept.'}
        </Modal>
      )}

      {showApplications && (
        <Modal
          title="Application history"
          confirmLabel="Done"
          onConfirm={() => setShowApplications(false)}
          onCancel={() => setShowApplications(false)}
        >
          <ApplicationHistory
            applications={state.applications}
            busy={busy}
            onUndo={toggleApplied}
          />
        </Modal>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path="*" element={<App />} />
    </Routes>
  </BrowserRouter>,
);
