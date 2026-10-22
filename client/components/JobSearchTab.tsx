import type { Backup } from '../../shared/history.js';

type SearchTab = Backup['tabs'][number];

type JobSearchTabProps = {
  tab: SearchTab;
  active: boolean;
  onSelect: (tab: SearchTab) => void;
};

export function JobSearchTab({ tab, active, onSelect }: JobSearchTabProps) {
  return (
    <button
      className={`search-tab${active ? ' search-tab--active' : ''}`}
      type="button"
      style={{ '--tab-color': tab.color } as React.CSSProperties}
      aria-current={active ? 'page' : undefined}
      onClick={() => onSelect(tab)}
    >
      {tab.config.title}
    </button>
  );
}
