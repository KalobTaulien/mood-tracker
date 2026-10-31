import type { SQLiteDatabase } from 'expo-sqlite';
import { nowIso } from '../lib/dates';
import { newId } from '../lib/ids';

/**
 * A tiny document store on top of SQLite.
 *
 * The form is user-defined, so the shape of an entry is not known until
 * runtime and cannot live in typed columns. Everything a document carries is
 * therefore kept as JSON in `json`; only the metadata the app has to *query*
 * by — collection and creation time — gets real columns and an index.
 *
 * This layer is deliberately untyped about `data`. It guarantees you get back
 * valid JSON or nothing at all; deciding whether that JSON is a well-formed
 * entry is the typed layer's job (see `entries.ts`, `form.ts`). That split is
 * what lets a single corrupt or future-version document be skipped instead of
 * breaking a whole screen.
 */

export const COLLECTIONS = {
  /** The one form definition, stored under `FORM_DOC_ID`. */
  form: 'form',
  /** One document per saved check-in. */
  entry: 'entry',
} as const;

export type Collection = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export type Doc<T> = {
  id: string;
  createdAt: string;
  updatedAt: string;
  data: T;
};

type DocRow = {
  id: string;
  created_at: string;
  updated_at: string;
  json: string;
};

/** Returns null — rather than throwing — when a row's JSON is unreadable. */
function parseRow(row: DocRow, collection: string): Doc<unknown> | null {
  try {
    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      data: JSON.parse(row.json) as unknown,
    };
  } catch {
    console.warn(`[store] skipping unreadable ${collection} document ${row.id}`);
    return null;
  }
}

/** Writes a document verbatim, replacing any existing one with the same id. */
export async function putDoc(
  db: SQLiteDatabase,
  collection: Collection,
  doc: Doc<unknown>
): Promise<void> {
  await db.runAsync(
    `INSERT INTO docs (collection, id, created_at, updated_at, json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(collection, id) DO UPDATE SET
       created_at = excluded.created_at,
       updated_at = excluded.updated_at,
       json       = excluded.json`,
    [collection, doc.id, doc.createdAt, doc.updatedAt, JSON.stringify(doc.data)]
  );
}

/** Builds a document around `data` with a fresh id and timestamps, and saves it. */
export async function createDoc(
  db: SQLiteDatabase,
  collection: Collection,
  data: unknown,
  createdAt: string = nowIso()
): Promise<Doc<unknown>> {
  const doc: Doc<unknown> = {
    id: newId(),
    createdAt,
    updatedAt: createdAt,
    data,
  };
  await putDoc(db, collection, doc);
  return doc;
}

export async function getDoc(
  db: SQLiteDatabase,
  collection: Collection,
  id: string
): Promise<Doc<unknown> | null> {
  const row = await db.getFirstAsync<DocRow>(
    'SELECT id, created_at, updated_at, json FROM docs WHERE collection = ? AND id = ?',
    [collection, id]
  );
  return row ? parseRow(row, collection) : null;
}

export type ListOptions = {
  /** Inclusive lower bound on `createdAt`, as an ISO string. */
  since?: string;
  limit?: number;
  /** Defaults to newest first, which is what History wants. */
  order?: 'newest' | 'oldest';
};

export async function listDocs(
  db: SQLiteDatabase,
  collection: Collection,
  { since, limit, order = 'newest' }: ListOptions = {}
): Promise<Doc<unknown>[]> {
  const direction = order === 'oldest' ? 'ASC' : 'DESC';
  const params: (string | number)[] = [collection];
  let sql = 'SELECT id, created_at, updated_at, json FROM docs WHERE collection = ?';

  if (since !== undefined) {
    sql += ' AND created_at >= ?';
    params.push(since);
  }
  sql += ` ORDER BY created_at ${direction}, id ${direction}`;
  if (limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const rows = await db.getAllAsync<DocRow>(sql, params);
  return rows
    .map((row) => parseRow(row, collection))
    .filter((doc): doc is Doc<unknown> => doc !== null);
}

export async function deleteDoc(
  db: SQLiteDatabase,
  collection: Collection,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM docs WHERE collection = ? AND id = ?', [collection, id]);
}

export async function countDocs(
  db: SQLiteDatabase,
  collection: Collection
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM docs WHERE collection = ?',
    [collection]
  );
  return row?.count ?? 0;
}

export async function clearCollection(
  db: SQLiteDatabase,
  collection: Collection
): Promise<void> {
  await db.runAsync('DELETE FROM docs WHERE collection = ?', [collection]);
}
