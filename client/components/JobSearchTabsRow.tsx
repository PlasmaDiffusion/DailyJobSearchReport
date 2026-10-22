import type { Backup } from '../../shared/history.js';
import { Button } from './common/Button.js';
import { JobSearchTab } from './JobSearchTab.js';

type SearchTab = Backup['tabs'][number];

type JobSearchTabsRowProps = {
  tabs: SearchTab[];
  activeId?: string;
  disabled: boolean;
  onSelect: (tab: SearchTab) => void;
  onNewTab: () => void;
};

export function JobSearchTabsRow({
  tabs,
  activeId,
  disabled,
  onSelect,
  onNewTab,
}: JobSearchTabsRowProps) {
  return (
    <nav className="tabs-row" aria-label="Search tabs">
      <div className="tabs-scroll-area">
        {tabs.map((tab) => (
          <JobSearchTab
            key={tab.id}
            tab={tab}
            active={tab.id === activeId}
            onSelect={onSelect}
          />
        ))}
        <Button className="new-tab-button" disabled={disabled} onClick={onNewTab}>
          + New Tab
        </Button>
      </div>
    </nav>
  );
}
