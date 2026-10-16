import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'mood-tracker.db';
const DATABASE_VERSION = 2;

/**
 * Runs on every app start via SQLiteProvider's `onInit`.
 * Bump DATABASE_VERSION and append a new `if (currentDbVersion === n)` block to migrate.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentDbVersion = result?.user_version ?? 0;

  if (currentDbVersion >= DATABASE_VERSION) return;

  if (currentDbVersion === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS logs (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at         TEXT    NOT NULL,
        updated_at         TEXT    NOT NULL,
        mood_score         INTEGER,
        mood_word          TEXT,
        lonely_at          TEXT,
        lonely_note        TEXT,
        exercised          INTEGER,
        exercise_note      TEXT,
        self_harm_thoughts TEXT,
        fatigue_score      INTEGER,
        last_vegetable_at  TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs (created_at DESC);

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT
      );
    `);
    currentDbVersion = 1;
  }

  if (currentDbVersion === 1) {
    // Reminders are scheduled on-device now, so the Expo push token kept for
    // the old Cloudflare Worker has no reader left.
    await db.execAsync(`
      DELETE FROM settings
       WHERE key IN ('push_token', 'push_token_registered_at');
    `);
    currentDbVersion = 2;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
