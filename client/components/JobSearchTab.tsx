import type { Backup } from '../../shared/history.js';
import { themeFor } from '../../shared/themes.js';

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
      style={{ '--tab-color': tab.color.startsWith('#') ? tab.color : themeFor(tab.color).color, '--tab-text': themeFor(tab.color).text } as React.CSSProperties}
      aria-current={active ? 'page' : undefined}
      onClick={() => onSelect(tab)}
    >
      {tab.config.title}
    </button>
  );
}
