/** A time of day for a daily reminder, in the device's local timezone. */
export type ReminderTime = { hour: number; minute: number };

export const DEFAULT_REMINDER_TIMES: readonly ReminderTime[] = [
  { hour: 9, minute: 0 },
  { hour: 14, minute: 0 },
  { hour: 20, minute: 0 },
];

/** How many reminders fire per day. The Reminders screen renders this many pickers. */
export const REMINDER_COUNT = DEFAULT_REMINDER_TIMES.length;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Chronological order, so the stored list always reads top-to-bottom through the day. */
export function sortReminderTimes(times: readonly ReminderTime[]): ReminderTime[] {
  return [...times].sort((a, b) => a.hour - b.hour || a.minute - b.minute);
}

/** `"09:00,14:00,20:00"` — readable as-is if you ever inspect the settings table. */
export function serializeReminderTimes(times: readonly ReminderTime[]): string {
  return times.map((time) => `${pad(time.hour)}:${pad(time.minute)}`).join(',');
}

/**
 * Reads back what serializeReminderTimes wrote. Anything malformed — a missing
 * row, a hand-edited value, a format from some future build — falls back to the
 * defaults rather than scheduling nonsense.
 */
export function parseReminderTimes(raw: string | null): ReminderTime[] {
  const fallback = () => [...DEFAULT_REMINDER_TIMES];
  if (!raw) return fallback();

  const parsed: ReminderTime[] = [];
  for (const part of raw.split(',')) {
    const match = /^(\d{1,2}):(\d{1,2})$/.exec(part.trim());
    if (!match) return fallback();

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return fallback();

    parsed.push({ hour, minute });
  }

  if (parsed.length !== REMINDER_COUNT) return fallback();
  return sortReminderTimes(parsed);
}

/** Localised label such as "9:00 AM", following the device's clock preference. */
export function formatReminderTime({ hour, minute }: ReminderTime): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function reminderTimesEqual(
  a: readonly ReminderTime[],
  b: readonly ReminderTime[]
): boolean {
  return serializeReminderTimes(a) === serializeReminderTimes(b);
}
