import type { SearchConfig } from "../../server/config.js";
import { Button } from "./common/Button.js";
import { ThemeMenu } from "./ThemeMenu.js";

type JobSearchFormProps = {
  config: SearchConfig;
  disabled: boolean;
  onChange: <Key extends keyof SearchConfig>(
    key: Key,
    value: SearchConfig[Key]
  ) => void;
  onSave: () => void;
  onApply: () => void;
  hasActiveTab: boolean;
  onSearch: () => void;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  unlockedThemes: string[];
  coins: number;
  customPickerUnlocked: boolean;
  onUnlockTheme: (id: string, cost: number) => void;
  onUnlockCustom: () => void;
  onCustomColor: (color: string) => void;
  onDeleteTab?: () => void;
};

const listFields = [
  ["companies", "Companies"],
  ["roles", "Job titles"],
  ["excludedTitles", "Title keywords to exclude"],
  ["skills", "Key skills"],
  ["excludedCompanies", "Companies to exclude"],
  ["locations", "Locations"],
] as const;

const strictFields = [
  ["strictCompany", "Require a listed company"],
  ["strictRole", "Require a listed title"],
  ["strictSkills", "Require all listed skills"],
] as const;

export function JobSearchForm({
  config,
  disabled,
  onChange,
  onSave,
  onApply,
  hasActiveTab,
  onSearch,
  accentColor,
  onAccentColorChange,
  unlockedThemes,
  coins,
  customPickerUnlocked,
  onUnlockTheme,
  onUnlockCustom,
  onCustomColor,
  onDeleteTab,
}: JobSearchFormProps) {
  return (
    <section className="search-form-panel">
      <div className="form-heading">
        <div>
          <h1>Shape your search</h1>
          <p>
            Search when you’re ready. Your settings and reports stay in this
            browser.
          </p>
        </div>
        <div className="form-header-actions">
          <ThemeMenu
            value={accentColor}
            unlocked={unlockedThemes}
            coins={coins}
            customUnlocked={customPickerUnlocked}
            onSelect={onAccentColorChange}
            onUnlock={onUnlockTheme}
            onUnlockCustom={onUnlockCustom}
            onCustomColor={onCustomColor}
          />
          <Button variant="primary" disabled={disabled} onClick={onSearch}>
            {disabled ? "Searching…" : "Search now"}
          </Button>
        </div>
      </div>

      <fieldset disabled={disabled} className="search-fields">
        <div className="form-grid">
          <label className="field-label">
            Tab title
            <input
              value={config.title}
              onChange={(event) => onChange("title", event.target.value)}
            />
          </label>

          <fieldset className="mode-field">
            <legend>Search mode</legend>
            <label className="choice-label">
              <input
                type="radio"
                name="mode"
                checked={config.mode === "jobs"}
                onChange={() => onChange("mode", "jobs")}
              />
              Jobs
            </label>
            <label className="choice-label">
              <input
                type="radio"
                name="mode"
                checked={config.mode === "news"}
                onChange={() => onChange("mode", "news")}
              />
              Tech news
            </label>
          </fieldset>
        </div>

        {config.mode === "jobs" ? (
          <>
            <div className="form-grid form-grid--criteria">
              {listFields.map(([key, label]) => (
                <label className="field-label" key={key}>
                  {label}
                  <input
                    // Do not add formatting spaces here: the controlled input
                    // would put them back immediately when the user deletes one.
                    value={config[key].join(",")}
                    placeholder="Separate entries with commas"
                    onChange={(event) =>
                      onChange(
                        key,
                        // Keep whitespace or spaces while typing; validation trims terms later.
                        event.target.value.split(",")
                      )
                    }
                  />
                </label>
              ))}
            </div>

            <div className="strict-options">
              {strictFields.map(([key, label]) => (
                <label className="choice-label" key={key}>
                  <input
                    type="checkbox"
                    checked={config[key]}
                    onChange={(event) => onChange(key, event.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>

            <label className="field-label">
              Resume text
              <textarea
                rows={4}
                value={config.resume}
                onChange={(event) => onChange("resume", event.target.value)}
                placeholder="Paste your resume for fit scores and ATS keyword suggestions"
              />
            </label>
            <p className="privacy-note">
              Saved locally and sent through the backend to OpenAI when you
              search. Your JSON backup includes your resume.
            </p>
          </>
        ) : (
          <label className="field-label news-prompt">
            News search prompt
            <textarea
              rows={4}
              value={config.prompt}
              onChange={(event) => onChange("prompt", event.target.value)}
              placeholder="New technologies for software developers, or industry trends…"
            />
          </label>
        )}

        <div className="form-footer">
          <label className="field-label results-limit">
            Results to search (1–20)
            <input
              type="number"
              min={1}
              max={20}
              value={config.limit}
              onChange={(event) =>
                onChange("limit", Number(event.target.value))
              }
            />
          </label>
          <Button variant="primary" onClick={onSave}>
            Save As New Tab
          </Button>
          <Button disabled={!hasActiveTab} onClick={onApply}>
            Apply Changes To Current Tab
          </Button>
          {onDeleteTab && (
            <Button variant="primary" onClick={onDeleteTab}>
              Delete tab
            </Button>
          )}
        </div>

        <p className="form-hint">
          Excluded title keywords and companies are removed from results. Jobs
          shown in this tab or marked as applied within the last 30 days are
          also excluded. Strict filters may return fewer results than requested.
        </p>
      </fieldset>
    </section>
  );
}
