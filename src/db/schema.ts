import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'mood-tracker.db';
const DATABASE_VERSION = 4;

/**
 * Nullable columns added to `logs` after the v1 baseline, oldest first.
 *
 * These are reconciled against the live table on every start rather than
 * applied by version number. Column adds are cheap and order-independent, and
 * checking means a database whose `user_version` ran ahead of its real schema
 * heals itself instead of failing every query for the missing column.
 */
const LOG_COLUMNS: readonly (readonly [name: string, type: string])[] = [
  ['fatigue_word', 'TEXT'],
  ['fatigue_note', 'TEXT'],
  ['last_junk_food_at', 'TEXT'],
  ['junk_food_note', 'TEXT'],
  ['last_processed_sugar_at', 'TEXT'],
  ['processed_sugar_note', 'TEXT'],
];

async function setVersion(db: SQLiteDatabase, version: number): Promise<void> {
  // PRAGMA will not take a bound parameter, so keep interpolation to integers.
  await db.execAsync(`PRAGMA user_version = ${Math.trunc(version)}`);
}

/** Adds whichever of `columns` the table is missing. No-op when all are present. */
async function addMissingColumns(
  db: SQLiteDatabase,
  table: string,
  columns: readonly (readonly [name: string, type: string])[]
): Promise<void> {
  const present = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  const existing = new Set(present.map((column) => column.name));

  for (const [name, type] of columns) {
    if (existing.has(name)) continue;
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  }
}

/**
 * Runs on every app start via SQLiteProvider's `onInit`.
 *
 * Each step stamps `user_version` as soon as its own work succeeds, so an
 * interrupted migration resumes where it stopped rather than recording progress
 * it never made. Adding a column needs only a `LOG_COLUMNS` entry. Anything
 * else — data backfills, index or table changes — needs both a new
 * `if (currentDbVersion === n)` block and a DATABASE_VERSION bump.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentDbVersion = result?.user_version ?? 0;

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
    await setVersion(db, 1);
    currentDbVersion = 1;
  }

  if (currentDbVersion === 1) {
    // Reminders are scheduled on-device now, so the Expo push token kept for
    // the old Cloudflare Worker has no reader left.
    await db.execAsync(`
      DELETE FROM settings
       WHERE key IN ('push_token', 'push_token_registered_at');
    `);
    await setVersion(db, 2);
    currentDbVersion = 2;
  }

  // Unconditional: this is what repairs a database stamped ahead of its schema.
  await addMissingColumns(db, 'logs', LOG_COLUMNS);

  if (currentDbVersion !== DATABASE_VERSION) await setVersion(db, DATABASE_VERSION);
}
