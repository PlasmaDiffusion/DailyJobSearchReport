import type { Backup } from '../../shared/history.js';
import { Button } from './common/Button.js';

type ApplicationHistoryProps = {
  applications: Backup['applications'];
  busy: boolean;
  onUndo: (application: Backup['applications'][number]) => void;
};

export function ApplicationHistory({ applications, busy, onUndo }: ApplicationHistoryProps) {
  if (!applications.length) {
    return <p className="application-empty">No applications recorded yet.</p>;
  }

  return (
    <div className="application-list">
      {applications.map((application) => (
        <article className="application-item" key={application.url}>
          <div>
            <a href={application.url} target="_blank" rel="noreferrer">
              {application.title} · {application.company}
            </a>
            <p>
              <strong className={`application-status application-status--${application.status}`}>
                {application.status === 'ignored' ? 'Ignored' : 'Applied'}
              </strong>
              {' · '}{new Date(application.appliedAt).toLocaleDateString()}
            </p>
          </div>
          <Button disabled={busy} onClick={() => onUndo(application)}>Undo</Button>
        </article>
      ))}
    </div>
  );
}
