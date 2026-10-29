import type { Backup } from '../shared/history.js';

/** Apply a theme color to the active tab and persist the draft selection. */
export function selectTheme(state: Backup, activeId: string | undefined, color: string): Backup {
  const tabs = activeId
    ? state.tabs.map((tab) => tab.id === activeId ? { ...tab, color } : tab)
    : state.tabs;
  return { ...state, tabs };
}

/** Spend coins to unlock and select a theme. Returns null when it cannot be unlocked. */
export function unlockTheme(
  state: Backup,
  activeId: string | undefined,
  id: string,
  cost: number,
): Backup | null {
  if (state.unlockedThemes.includes(id) || state.coins < cost) return null;
  const tabs = activeId
    ? state.tabs.map((tab) => tab.id === activeId ? { ...tab, color: id } : tab)
    : state.tabs;
  return {
    ...state,
    tabs,
    coins: state.coins - cost,
    unlockedThemes: [...state.unlockedThemes, id],
  };
}

/** Spend coins to unlock the custom color picker. */
export function unlockCustomPicker(state: Backup): Backup | null {
  if (state.customPickerUnlocked || state.coins < 300) return null;
  return { ...state, coins: state.coins - 300, customPickerUnlocked: true };
}
