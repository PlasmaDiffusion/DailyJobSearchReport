export type Theme = { id: string; label: string; color: string; text: string; cost: number };

export const THEMES: Theme[] = [
  { id: 'yellow', label: 'Yellow', color: '#f6d000', text: '#181818', cost: 0 },
  { id: 'orange', label: 'Orange', color: '#f28c28', text: '#181818', cost: 0 },
  { id: 'red', label: 'Red', color: '#ff5056', text: '#181818', cost: 0 },
  { id: 'light-blue', label: 'Light blue', color: '#8bd3f7', text: '#181818', cost: 10 },
  { id: 'blue', label: 'Blue', color: '#2878d0', text: '#fff', cost: 10 },
  { id: 'purple', label: 'Purple', color: '#8155c7', text: '#fff', cost: 10 },
  { id: 'violet', label: 'Violet', color: '#a34fc4', text: '#fff', cost: 10 },
  { id: 'green', label: 'Green', color: '#27864a', text: '#fff', cost: 10 },
  { id: 'light-green', label: 'Light green', color: '#a6d96a', text: '#181818', cost: 10 },
  { id: 'pink', label: 'Pink', color: '#ed8ab5', text: '#181818', cost: 10 },
  { id: 'brown', label: 'Brown', color: '#8b5a2b', text: '#fff', cost: 10 },
  { id: 'grey', label: 'Grey', color: '#777', text: '#fff', cost: 10 },
  { id: 'light-grey', label: 'Light grey', color: '#c9c9c9', text: '#181818', cost: 10 },
  { id: 'light-yellow', label: 'Light yellow', color: '#fff1a8', text: '#181818', cost: 10 },
  { id: 'maroon', label: 'Maroon', color: '#800d24', text: '#fff', cost: 10 },
  { id: 'navy-blue', label: 'Navy blue', color: '#142b55', text: '#fff', cost: 10 },
  { id: 'teal', label: 'Teal', color: '#168b8b', text: '#fff', cost: 10 },
  { id: 'halloween', label: 'Halloween', color: '#702090', text: '#ff8a22', cost: 30 },
  { id: 'christmas', label: 'Christmas', color: '#c8212b', text: '#fff', cost: 30 },
];
export const DEFAULT_THEME = THEMES[0];
export function themeFor(value: string): Theme {
  return THEMES.find((theme) => theme.id === value)
    || THEMES.find((theme) => theme.color.toLowerCase() === value.toLowerCase())
    || DEFAULT_THEME;
}
