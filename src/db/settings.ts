import type { SQLiteDatabase } from 'expo-sqlite';
import {
  parseReminderTimes,
  serializeReminderTimes,
  type ReminderTime,
} from '../lib/reminderTimes';

export const SETTING_KEYS = {
  localRemindersEnabled: 'local_reminders_enabled',
  reminderTimes: 'reminder_times',
} as const;

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(
  db: SQLiteDatabase,
  key: string,
  value: string | null
): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

/** The configured reminder times, or the defaults when none have been saved. */
export async function getReminderTimes(db: SQLiteDatabase): Promise<ReminderTime[]> {
  return parseReminderTimes(await getSetting(db, SETTING_KEYS.reminderTimes));
}

export async function setReminderTimes(
  db: SQLiteDatabase,
  times: readonly ReminderTime[]
): Promise<void> {
  await setSetting(db, SETTING_KEYS.reminderTimes, serializeReminderTimes(times));
}
