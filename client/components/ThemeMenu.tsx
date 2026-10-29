import { THEMES, themeFor } from "../../shared/themes.js";

type Props = {
  value: string;
  unlocked: string[];
  coins: number;
  customUnlocked: boolean;
  onSelect: (id: string) => void;
  onUnlock: (id: string, cost: number) => void;
  onUnlockCustom: () => void;
  onCustomColor: (color: string) => void;
};

export function ThemeMenu({
  value,
  unlocked,
  coins,
  customUnlocked,
  onSelect,
  onUnlock,
  onUnlockCustom,
  onCustomColor,
}: Props) {
  const selectedTheme = themeFor(value);
  return (
    <details className="theme-menu">
      <summary aria-label="Choose workspace theme">
        <span
          className="theme-swatch"
          style={{ background: selectedTheme.color }}
        />{" "}
        Themes
      </summary>
      <div className="theme-menu-panel">
        {THEMES.map((theme) => {
          const owned = theme.cost === 0 || unlocked.includes(theme.id);
          return (
            <button
              key={theme.id}
              type="button"
              className={`theme-option${
                value === theme.id ||
                (selectedTheme.id === theme.id && value.startsWith("#"))
                  ? " theme-option--selected"
                  : ""
              }`}
              onClick={() =>
                owned ? onSelect(theme.id) : onUnlock(theme.id, theme.cost)
              }
              disabled={!owned && coins < theme.cost}
              aria-label={`${theme.label}${
                owned ? "" : `, unlock for ${theme.cost} coins`
              }`}
            >
              <span
                className="theme-swatch"
                style={{ background: theme.color }}
              />
              <span>{theme.label}</span>
              {!owned && <small>🔒 {theme.cost}¢</small>}
              {owned && value === theme.id && <small>Selected</small>}
            </button>
          );
        })}
        {customUnlocked ? (
          <label className="custom-theme-picker">
            Custom colour
            <input
              type="color"
              value={value.startsWith("#") ? value : selectedTheme.color}
              onChange={(event) => onCustomColor(event.target.value)}
            />
          </label>
        ) : (
          <button
            type="button"
            className="theme-option"
            disabled={coins < 300}
            onClick={onUnlockCustom}
          >
            <span>Custom colour picker</span>
            <small>🔒 300¢</small>
          </button>
        )}
      </div>
    </details>
  );
}
