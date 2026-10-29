const ACTIVITY_DATES_KEY = 'djs.activityDates';

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function readActivityDates(): string[] {
  try {
    const dates: unknown = JSON.parse(localStorage.getItem(ACTIVITY_DATES_KEY) || '[]');
    return Array.isArray(dates) ? dates.filter((date): date is string => /^\d{4}-\d{2}-\d{2}$/.test(date)) : [];
  } catch {
    return [];
  }
}

export function streakLength(dates: string[], today = localDateKey()): number {
  const completed = new Set(dates);
  const cursor = new Date(`${today}T12:00:00`);
  if (!completed.has(today)) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (completed.has(localDateKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function markSearchDay(): { dates: string[]; streak: number } {
  const today = localDateKey();
  const dates = [...new Set([...readActivityDates(), today])].sort();
  localStorage.setItem(ACTIVITY_DATES_KEY, JSON.stringify(dates));
  return { dates, streak: streakLength(dates, today) };
}
