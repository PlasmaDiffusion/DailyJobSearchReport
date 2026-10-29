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
  currentStreak: number;
};

export function JobSearchTabsRow({
  tabs,
  activeId,
  disabled,
  onSelect,
  onNewTab,
  currentStreak,
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
        <span
          className="streak-counter"
          title="Search or apply on a day to keep your streak. At 4 or more consecutive days, each search or application earns 2 coins. A missed day resets the streak and rewards to 1 coin."
          aria-label={`Current streak: ${currentStreak} days`}
        >
          Current Streak: {currentStreak} Days
        </span>
      </div>
    </nav>
  );
}
