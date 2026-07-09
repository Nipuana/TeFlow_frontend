/** Small date helpers for deadlines. */

/** A yyyy-mm-dd date input value → ISO datetime (midnight UTC), or null. */
export function dateInputToIso(value: string): string | null {
  if (!value) return null;
  const iso = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
}

/** ISO datetime → yyyy-mm-dd for a date input. */
export function isoToDateInput(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

/** ISO datetime → a compact, timezone-safe label like "Jul 15" (or "—" if unset).
 *  Formats the UTC calendar date so it never shifts a day in other timezones. */
export function shortDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric' });
}

export interface DueInfo {
  label: string;
  overdue: boolean;
  soon: boolean; // due within 48h
}

/**
 * Whole-calendar-days from today until the due date.
 *
 * A due date is a CALENDAR date (stored as UTC midnight by `dateInputToIso`), so
 * we must compare it day-to-day, not instant-to-instant. Mixing the UTC-midnight
 * due value with a local `Date.now()` shifts the count by a day for anyone not on
 * UTC (e.g. "due today" showing as "1d overdue" in the US evening). We therefore
 * project BOTH the due date (from its UTC fields) and today (from LOCAL fields)
 * onto the same day-number axis, giving an exact, timezone-proof integer.
 */
function daysUntil(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dueDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((dueDay - today) / 86_400_000);
}

/** Human due-date summary relative to now. */
export function dueInfo(iso?: string | null, done = false): DueInfo | null {
  if (!iso) return null;
  const days = daysUntil(iso);
  if (days === null) return null;
  const overdue = !done && days < 0;
  const soon = !done && days >= 0 && days <= 2;
  let label: string;
  if (days === 0) label = 'due today';
  else if (days === 1) label = 'due tomorrow';
  else if (days > 1) label = `due in ${days}d`;
  else if (days === -1) label = '1d overdue';
  else label = `${Math.abs(days)}d overdue`;
  return { label, overdue, soon };
}
