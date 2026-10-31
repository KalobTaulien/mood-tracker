import type { SQLiteDatabase } from 'expo-sqlite';
import { normalizeEntryData, starterForm, type EntryValues } from '../forms';
import { FORM_DOC_ID } from '../forms/types';
import { COLLECTIONS, getDoc, putDoc } from './docs';

/**
 * One-time move from the old fixed-column `logs` table into the document store.
 *
 * Before the form became user-defined, every tracked field was a column on
 * `logs`. The starter form reuses those exact column names as its field ids,
 * so migrating a row is a matter of reading each column into a value map.
 *
 * Two properties make this safe to run on a journal someone actually relies on:
 *
 * - **Deterministic ids.** An entry derived from `logs.id = 7` is always
 *   `legacy-7`, so re-running replaces rather than duplicates.
 * - **Verify before stamping.** The "already migrated" marker is only written
 *   once the number of migrated documents matches the number of source rows.
 *   An interrupted run simply resumes on the next launch.
 *
 * The `logs` table is left in place afterwards. It costs little and it is the
 * only copy of the original data if a mapping bug ever surfaces.
 */

export const LEGACY_MIGRATION_KEY = 'legacy_logs_migrated_at';

/** Columns whose values are integers that mean yes/no rather than a number. */
const BOOLEAN_COLUMNS = new Set(['exercised']);

/** Columns that are bookkeeping, not answers. */
const META_COLUMNS = new Set(['id', 'created_at', 'updated_at']);

function legacyEntryId(rowId: number): string {
  return `legacy-${rowId}`;
}

async function tableExists(db: SQLiteDatabase, table: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [table]
  );
  return row !== null && row !== undefined;
}

/**
 * Reads one `logs` row into a value map.
 *
 * `SELECT *` rather than a fixed column list, because the old schema grew over
 * several releases and a given device may be missing the newest columns.
 */
function rowToValues(row: Record<string, unknown>): EntryValues {
  const values: EntryValues = {};

  for (const [column, raw] of Object.entries(row)) {
    if (META_COLUMNS.has(column) || raw === null || raw === undefined) continue;
    if (BOOLEAN_COLUMNS.has(column)) {
      values[column] = raw !== 0;
    } else if (typeof raw === 'number' || typeof raw === 'string') {
      values[column] = raw;
    }
  }

  return values;
}

export type LegacyMigrationResult = {
  /** Rows found in `logs`. */
  found: number;
  /** Documents written. Equal to `found` on a complete run. */
  migrated: number;
  complete: boolean;
};

/**
 * Copies every `logs` row into the entry collection, seeding the starter form
 * first if no form has been saved yet. Safe to call repeatedly.
 */
export async function migrateLegacyLogs(
  db: SQLiteDatabase
): Promise<LegacyMigrationResult> {
  if (!(await tableExists(db, 'logs'))) {
    return { found: 0, migrated: 0, complete: true };
  }

  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM logs ORDER BY id ASC'
  );
  if (rows.length === 0) return { found: 0, migrated: 0, complete: true };

  // The starter form is what gives the legacy column names meaning, so it has
  // to exist before the entries that reference them.
  const existingForm = await getDoc(db, COLLECTIONS.form, FORM_DOC_ID);
  const form = existingForm ? null : starterForm();
  if (form) {
    const now = new Date().toISOString();
    await putDoc(db, COLLECTIONS.form, {
      id: FORM_DOC_ID,
      createdAt: now,
      updatedAt: now,
      data: form,
    });
  } else {
    console.warn(
      '[store] migrating legacy logs into an existing form; answers for fields that form does not define will be dropped'
    );
  }

  const fields = (form ?? starterForm()).fields;
  let migrated = 0;

  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const rowId = Number(row.id);
      if (!Number.isFinite(rowId)) continue;

      const createdAt = typeof row.created_at === 'string' ? row.created_at : null;
      if (!createdAt) continue;
      const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : createdAt;

      // Round-trip through the normalizer so a migrated entry is byte-identical
      // to one the app would have written itself.
      const { values } = normalizeEntryData({ values: rowToValues(row) }, fields);

      await putDoc(db, COLLECTIONS.entry, {
        id: legacyEntryId(rowId),
        createdAt,
        updatedAt,
        data: { values },
      });
      migrated += 1;
    }
  });

  return { found: rows.length, migrated, complete: migrated === rows.length };
}
