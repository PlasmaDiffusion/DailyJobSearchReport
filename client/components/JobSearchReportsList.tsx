import type { Report } from '../../shared/history.js';

type JobSearchReportsListProps = {
  reports: Report[];
  activeMode?: 'jobs' | 'news';
  appliedUrls: Set<string>;
  onToggleApplied: (result: Report['results'][number]) => void;
};

export function JobSearchReportsList({
  reports,
  activeMode,
  appliedUrls,
  onToggleApplied,
}: JobSearchReportsListProps) {
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
      {reports.map((report) => (
        <section className="report-results" key={report.id}>
          <p className="report-date">{new Date(report.createdAt).toLocaleString()}</p>
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
                <button
                  className="text-action"
                  onClick={() => onToggleApplied(result)}
                >
                  {appliedUrls.has(result.url) ? 'Applied · undo' : 'Mark as applied'}
                </button>
              )}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
