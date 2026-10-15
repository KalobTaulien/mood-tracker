/** All timestamps are stored as ISO-8601 UTC strings; bucketing happens in JS. */

export function nowIso(): string {
  return new Date().toISOString();
}

export function toIso(date: Date): string {
  return date.toISOString();
}

export function fromIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local calendar day key, e.g. "2026-10-15". */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Inclusive start-of-day boundary `days - 1` days back, so "7 days" covers today + 6. */
export function rangeStart(days: number, from: Date = new Date()): Date {
  const start = startOfLocalDay(from);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

/** Ordered list of local day keys covering the range, oldest first. */
export function dayKeysForRange(days: number, from: Date = new Date()): string[] {
  const keys: string[] = [];
  const cursor = rangeStart(days, from);
  for (let i = 0; i < days; i++) {
    keys.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

export function formatDateTime(iso: string | null | undefined): string {
  const d = fromIso(iso);
  if (!d) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDate(iso: string | null | undefined): string {
  const d = fromIso(iso);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatTime(iso: string | null | undefined): string {
  const d = fromIso(iso);
  if (!d) return '—';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "3 days ago", "in 2 hours", "just now" — relative to now. */
export function relativeFromNow(iso: string | null | undefined): string {
  const d = fromIso(iso);
  if (!d) return '—';
  const diffMs = Date.now() - d.getTime();
  const future = diffMs < 0;
  const abs = Math.abs(diffMs);

  const mins = Math.round(abs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`;

  const hours = Math.round(mins / 60);
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return future ? `in ${days}d` : `${days}d ago`;

  const months = Math.round(days / 30);
  if (months < 12) return future ? `in ${months}mo` : `${months}mo ago`;

  const years = Math.round(months / 12);
  return future ? `in ${years}y` : `${years}y ago`;
}

/** Day heading used to group the history list. */
export function dayHeading(iso: string): string {
  const d = fromIso(iso);
  if (!d) return 'Unknown';
  const today = dayKey(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const key = dayKey(d);
  if (key === today) return 'Today';
  if (key === dayKey(yesterdayDate)) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}
