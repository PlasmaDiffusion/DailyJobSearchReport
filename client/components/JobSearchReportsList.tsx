import type { Report } from '../../shared/history.js';
import { useState } from 'react';

type JobSearchReportsListProps = {
  reports: Report[];
  activeMode?: 'jobs' | 'news';
  applicationStatusByUrl: Map<string, 'applied' | 'ignored'>;
  onSetApplicationStatus: (result: Report['results'][number], status: 'applied' | 'ignored') => void;
  onRemoveReport?: (report: Report) => void;
};

export function JobSearchReportsList({
  reports,
  activeMode,
  applicationStatusByUrl,
  onSetApplicationStatus,
  onRemoveReport,
}: JobSearchReportsListProps) {
  const [expandedByReport, setExpandedByReport] = useState<Record<string, boolean>>({});

  if (!reports.length) {
    return (
      <div className="report-empty-state">
        <span className="empty-state-mark" aria-hidden="true">↗</span>
        <h3>Your report will appear here</h3>
        <p>Choose your search criteria, then hit Search Now to find matching jobs.</p>
      </div>
    );
  }

  return (
    <div className="reports-scroll-area">
      {reports.map((report) => {
        const reportDate = new Date(report.createdAt);
        const today = new Date();
        const isToday = reportDate.getFullYear() === today.getFullYear()
          && reportDate.getMonth() === today.getMonth()
          && reportDate.getDate() === today.getDate();
        const expanded = expandedByReport[report.id] ?? isToday;

        return (
        <section className="report-results" key={report.id}>
          <div className="report-meta">
            <button
              className="report-date-toggle"
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpandedByReport((current) => ({ ...current, [report.id]: !expanded }))}
            >
              <span className={`report-date-chevron${expanded ? ' report-date-chevron--open' : ''}`} aria-hidden="true">▸</span>
              <span className="report-date">{reportDate.toLocaleString()}</span>
            </button>
            {activeMode === 'news' && onRemoveReport && (
              <button className="text-action" type="button" onClick={() => onRemoveReport(report)}>
                Remove report
              </button>
            )}
          </div>
          {expanded && <div className="report-content">
          {report.warnings.map((warning, index) => (
            <p className="report-warning" key={`${report.id}-${index}`}>{warning}</p>
          ))}
          {!report.results.length && <p className="no-results">No matching results were found.</p>}

          {report.results.map((result, index) => (
            <article className="job-result" key={`${result.url}-${index}`}>
              <div className="job-result-heading">
                <a href={result.url} target="_blank" rel="noreferrer">
                  {result.title}{result.company && ` at ${result.company}`} ↗
                </a>
                {result.fitScore !== null && <span>{result.fitScore}% fit</span>}
              </div>
              <p className="job-summary">{result.summary}</p>
              {result.resumeMatch && <p className="resume-match">{result.resumeMatch}</p>}
              {result.keyGaps.length > 0 && (
                <p className="job-details"><strong>Gaps:</strong> {result.keyGaps.join(', ')}</p>
              )}
              {result.missingKeywords.length > 0 && (
                <p className="job-details">
                  <strong>ATS keywords:</strong> {result.missingKeywords.join(', ')}
                </p>
              )}
              {activeMode !== 'news' && (
                <div className="job-result-actions">
                  <button
                    className="text-action"
                    onClick={() => onSetApplicationStatus(result, 'applied')}
                  >
                    {applicationStatusByUrl.get(result.url) === 'applied' ? 'Applied · undo' : 'Mark as applied'}
                  </button>
                  <button
                    className="text-action"
                    onClick={() => onSetApplicationStatus(result, 'ignored')}
                  >
                    {applicationStatusByUrl.get(result.url) === 'ignored' ? 'Ignored · undo' : 'Ignore'}
                  </button>
                </div>
              )}
            </article>
          ))}
          </div>}
        </section>
        );
      })}
    </div>
  );
}
