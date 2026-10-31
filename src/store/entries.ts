import type { SQLiteDatabase } from 'expo-sqlite';
import { nowIso } from '../lib/dates';
import {
  normalizeEntryData,
  pruneValues,
  type EntryValues,
  type FieldValue,
  type FormField,
} from '../forms';
import {
  COLLECTIONS,
  countDocs,
  createDoc,
  deleteDoc,
  getDoc,
  listDocs,
  putDoc,
  type Doc,
  type ListOptions,
} from './docs';

export type Entry = {
  id: string;
  createdAt: string;
  updatedAt: string;
  values: EntryValues;
};

function toEntry(doc: Doc<unknown>, fields: readonly FormField[]): Entry {
  return {
    id: doc.id,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    values: normalizeEntryData(doc.data, fields).values,
  };
}

export async function createEntry(
  db: SQLiteDatabase,
  values: EntryValues,
  createdAt: string = nowIso()
): Promise<string> {
  const doc = await createDoc(db, COLLECTIONS.entry, { values: pruneValues(values) }, createdAt);
  return doc.id;
}

export async function updateEntry(
  db: SQLiteDatabase,
  entry: Entry,
  values: EntryValues
): Promise<void> {
  await putDoc(db, COLLECTIONS.entry, {
    id: entry.id,
    createdAt: entry.createdAt,
    updatedAt: nowIso(),
    data: { values: pruneValues(values) },
  });
}

export async function getEntry(
  db: SQLiteDatabase,
  id: string,
  fields: readonly FormField[]
): Promise<Entry | null> {
  const doc = await getDoc(db, COLLECTIONS.entry, id);
  return doc ? toEntry(doc, fields) : null;
}

export async function listEntries(
  db: SQLiteDatabase,
  fields: readonly FormField[],
  options: ListOptions = {}
): Promise<Entry[]> {
  const docs = await listDocs(db, COLLECTIONS.entry, options);
  return docs.map((doc) => toEntry(doc, fields));
}

export async function deleteEntry(db: SQLiteDatabase, id: string): Promise<void> {
  await deleteDoc(db, COLLECTIONS.entry, id);
}

export async function countEntries(db: SQLiteDatabase): Promise<number> {
  return countDocs(db, COLLECTIONS.entry);
}

/**
 * How far back the "you last answered this" hints look.
 *
 * The answers live inside each document's JSON, so there is no index to seek
 * on — the lookup scans recent entries instead. A value older than this many
 * entries is not worth offering as a one-tap reuse anyway.
 */
const LOOKBACK_ENTRIES = 400;

/**
 * The most recent answer for each of `fieldIds`, for prefill hints.
 *
 * Date fields resolve to the latest *moment recorded*, which is not always the
 * newest entry's value: re-recording an older moment should not make it look
 * like the most recent one.
 */
export async function latestValues(
  db: SQLiteDatabase,
  fields: readonly FormField[],
  fieldIds: readonly string[]
): Promise<Record<string, FieldValue>> {
  if (fieldIds.length === 0) return {};

  const wanted = new Set(fieldIds);
  const byId = new Map(fields.map((field) => [field.id, field]));
  const entries = await listEntries(db, fields, { limit: LOOKBACK_ENTRIES });
  const out: Record<string, FieldValue> = {};

  for (const entry of entries) {
    for (const id of wanted) {
      const value = entry.values[id];
      if (value === undefined || value === null) continue;
      const existing = out[id];
      if (existing === undefined) {
        out[id] = value;
      } else if (byId.get(id)?.kind === 'datetime' && typeof value === 'string') {
        // ISO-8601 UTC strings sort lexicographically, so this is a date compare.
        if (value > String(existing)) out[id] = value;
      }
    }
  }

  return out;
}

/**
 * Strips one field's answers from every entry.
 *
 * Only called when the user explicitly chooses to erase a field's data rather
 * than archive it — without a definition there is no way to render the values
 * again, so leaving them behind would just be unreachable clutter.
 */
export async function eraseFieldValues(
  db: SQLiteDatabase,
  fieldId: string
): Promise<number> {
  const docs = await listDocs(db, COLLECTIONS.entry);
  let changed = 0;

  await db.withTransactionAsync(async () => {
    for (const doc of docs) {
      const data = doc.data;
      if (typeof data !== 'object' || data === null) continue;
      const values = (data as { values?: unknown }).values;
      if (typeof values !== 'object' || values === null) continue;
      if (!(fieldId in values)) continue;

      const { [fieldId]: _removed, ...rest } = values as Record<string, unknown>;
      await putDoc(db, COLLECTIONS.entry, {
        ...doc,
        updatedAt: nowIso(),
        data: { values: rest },
      });
      changed += 1;
    }
  });

  return changed;
}

/** How many entries carry an answer for `fieldId`. Shown before erasing it. */
export async function countFieldAnswers(
  db: SQLiteDatabase,
  fields: readonly FormField[],
  fieldId: string
): Promise<number> {
  const entries = await listEntries(db, fields);
  return entries.filter((entry) => {
    const value = entry.values[fieldId];
    return value !== undefined && value !== null && value !== '';
  }).length;
}
