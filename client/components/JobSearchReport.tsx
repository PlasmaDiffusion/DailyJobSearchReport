import type { Report } from '../../shared/history.js';
import { JobSearchReportsList } from './JobSearchReportsList.js';

type JobSearchReportProps = {
  reports: Report[];
  mode?: 'jobs' | 'news';
  applicationStatusByUrl: Map<string, 'applied' | 'ignored'>;
  onSetApplicationStatus: (result: Report['results'][number], status: 'applied' | 'ignored') => void;
};

export function JobSearchReport({ reports, mode, applicationStatusByUrl, onSetApplicationStatus }: JobSearchReportProps) {
  return (
    <section className="job-report-panel" aria-label="Job search report">
      <div className="report-panel-heading">
        <div>
          <h2>Job Report</h2>
          <p>{reports.reduce((count, report) => count + report.results.length, 0)} results</p>
        </div>
      </div>
      <JobSearchReportsList
        reports={reports}
        activeMode={mode}
        applicationStatusByUrl={applicationStatusByUrl}
        onSetApplicationStatus={onSetApplicationStatus}
      />
    </section>
  );
}
