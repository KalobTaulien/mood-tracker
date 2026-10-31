import type { SQLiteDatabase } from 'expo-sqlite';
import { nowIso } from '../lib/dates';
import { LEGACY_MIGRATION_KEY, migrateLegacyLogs } from './legacy';

export const DATABASE_NAME = 'mood-tracker.db';
const DATABASE_VERSION = 5;

/**
 * Schema setup, run on every app start via SQLiteProvider's `onInit`.
 *
 * The form is user-defined, so an entry's shape is not known until runtime and
 * cannot be expressed as columns. Everything is therefore kept in one `docs`
 * table whose payload is JSON, with real columns only for what has to be
 * queried: the collection and the creation time.
 *
 * All the DDL here is `IF NOT EXISTS` and runs unconditionally rather than
 * being gated on `user_version`. Creating a table that already exists costs
 * nothing, and it means a database stamped ahead of its real schema repairs
 * itself instead of failing every query.
 */
async function setVersion(db: SQLiteDatabase, version: number): Promise<void> {
  // PRAGMA will not take a bound parameter, so keep interpolation to integers.
  await db.execAsync(`PRAGMA user_version = ${Math.trunc(version)}`);
}

async function getSettingValue(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS docs (
      collection TEXT NOT NULL,
      id         TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      json       TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    );

    CREATE INDEX IF NOT EXISTS idx_docs_created
      ON docs (collection, created_at DESC);
  `);

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentDbVersion = result?.user_version ?? 0;

  if (currentDbVersion < 2) {
    // Reminders are scheduled on-device now, so the Expo push token kept for
    // the old Cloudflare Worker has no reader left.
    await db.execAsync(`
      DELETE FROM settings
       WHERE key IN ('push_token', 'push_token_registered_at');
    `);
    await setVersion(db, 2);
  }

  // Devices upgrading from a build that stored logs in fixed columns. The
  // marker is only stamped once every row has landed, so an interrupted run
  // resumes on the next launch instead of losing the remainder.
  if ((await getSettingValue(db, LEGACY_MIGRATION_KEY)) === null) {
    const migration = await migrateLegacyLogs(db);
    if (migration.complete) {
      await db.runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [LEGACY_MIGRATION_KEY, nowIso()]
      );
      if (migration.found > 0) {
        console.log(`[store] migrated ${migration.migrated} legacy logs into documents`);
      }
    } else {
      console.warn(
        `[store] legacy migration incomplete (${migration.migrated}/${migration.found}); will retry next launch`
      );
    }
  }

  if (currentDbVersion !== DATABASE_VERSION) await setVersion(db, DATABASE_VERSION);
}
