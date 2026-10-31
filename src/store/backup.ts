import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  normalizeEntryData,
  normalizeForm,
  type EntryValues,
  type FormDefinition,
  type FormField,
} from '../forms';
import { FORM_DOC_ID } from '../forms/types';
import { dayKey, nowIso } from '../lib/dates';
import { isValidId } from '../lib/ids';
import { COLLECTIONS, clearCollection, getDoc, listDocs, putDoc } from './docs';
import { listEntries } from './entries';
import { loadForm, saveForm } from './form';
import { SETTING_KEYS, getSetting, setSetting } from './settings';

/**
 * Local backup and restore.
 *
 * The app has no account and no server, which makes a lost phone a lost
 * journal — so there has to be *some* way out. This writes a plain JSON file
 * into the app's own cache and then hands it to the OS share sheet. Nothing is
 * uploaded: where the file goes next is entirely the user's choice, and the
 * app never learns what they picked.
 *
 * The format is deliberately readable rather than compact. A journal someone
 * keeps for years should not depend on this app still existing to be legible.
 */

const BACKUP_APP = 'mood-tracker';
const BACKUP_FORMAT_VERSION = 1;

type BackupEntry = {
  id: string;
  createdAt: string;
  updatedAt: string;
  values: EntryValues;
};

export type BackupFile = {
  app: string;
  formatVersion: number;
  exportedAt: string;
  form: FormDefinition;
  entries: BackupEntry[];
  /** Reminder preferences, so a restore puts the schedule back too. */
  settings: Record<string, string>;
};

export type ExportResult = {
  entryCount: number;
  fileName: string;
  /** False when the platform has no share sheet; the file still exists. */
  shared: boolean;
  uri: string;
};

function backupFileName(): string {
  return `mood-tracker-backup-${dayKey(new Date())}.json`;
}

/** Builds the backup payload without touching the filesystem. */
export async function buildBackup(db: SQLiteDatabase): Promise<BackupFile> {
  const form = await loadForm(db);
  const entries = await listEntries(db, form.fields, { order: 'oldest' });

  const settings: Record<string, string> = {};
  for (const key of Object.values(SETTING_KEYS)) {
    const value = await getSetting(db, key);
    if (value !== null) settings[key] = value;
  }

  return {
    app: BACKUP_APP,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: nowIso(),
    form,
    entries: entries.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      values: entry.values,
    })),
    settings,
  };
}

/**
 * Writes a backup to the cache directory and offers it to the share sheet.
 *
 * The cache is the right home for it: the file only needs to live long enough
 * for the user to send it somewhere, and the system is free to reclaim it
 * afterwards rather than leaving a copy of the journal lying around.
 */
export async function exportBackup(db: SQLiteDatabase): Promise<ExportResult> {
  const backup = await buildBackup(db);
  const fileName = backupFileName();
  const file = new File(Paths.cache, fileName);

  if (file.exists) file.delete();
  file.create();
  await file.write(JSON.stringify(backup, null, 2));

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Save your mood journal backup',
      UTI: 'public.json',
    });
  }

  return {
    entryCount: backup.entries.length,
    fileName,
    shared: canShare,
    uri: file.uri,
  };
}

export class BackupError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parses and validates a backup file's text, or throws a BackupError. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('That file is not valid JSON.');
  }

  if (!isRecord(raw)) throw new BackupError('That file does not contain a backup.');
  if (raw.app !== BACKUP_APP) {
    throw new BackupError('That file was not exported by Mood Tracker.');
  }

  const version = typeof raw.formatVersion === 'number' ? raw.formatVersion : 0;
  if (version > BACKUP_FORMAT_VERSION) {
    throw new BackupError(
      'That backup was made by a newer version of the app. Update first, then import it.'
    );
  }

  const form = normalizeForm(raw.form);
  const rawEntries = Array.isArray(raw.entries) ? raw.entries : [];
  const entries: BackupEntry[] = [];

  for (const candidate of rawEntries) {
    if (!isRecord(candidate)) continue;
    if (!isValidId(candidate.id)) continue;
    if (typeof candidate.createdAt !== 'string') continue;
    const updatedAt =
      typeof candidate.updatedAt === 'string' ? candidate.updatedAt : candidate.createdAt;

    entries.push({
      id: candidate.id,
      createdAt: candidate.createdAt,
      updatedAt,
      values: normalizeEntryData(candidate, form.fields).values,
    });
  }

  if (form.fields.length === 0 && entries.length === 0) {
    throw new BackupError('That backup is empty — there is nothing to import.');
  }

  const settings: Record<string, string> = {};
  if (isRecord(raw.settings)) {
    for (const [key, value] of Object.entries(raw.settings)) {
      if (typeof value === 'string') settings[key] = value;
    }
  }

  return {
    app: BACKUP_APP,
    formatVersion: version,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : nowIso(),
    form,
    entries,
    settings,
  };
}

/** Opens the system file picker and returns the parsed backup, or null if cancelled. */
export async function pickBackup(): Promise<BackupFile | null> {
  const picked = await File.pickFileAsync({
    // Some providers hand back octet-stream for .json, so stay permissive and
    // let parseBackup be the thing that rejects a wrong file.
    mimeTypes: ['application/json', 'text/plain', 'application/octet-stream'],
  });
  if (picked.canceled) return null;

  let text: string;
  try {
    text = await picked.result.text();
  } catch {
    throw new BackupError('That file could not be read.');
  }
  return parseBackup(text);
}

export type ImportMode = 'replace' | 'merge';

export type ImportResult = {
  mode: ImportMode;
  entriesAdded: number;
  entriesSkipped: number;
  /** Fields brought in from the backup, added hidden. Merge mode only. */
  fieldsAdded: number;
};

/**
 * Writes a parsed backup into the store.
 *
 * `replace` is the real-restore path: the current form and every entry are
 * discarded and the file becomes the truth.
 *
 * `merge` keeps the current form and only adds entries whose ids are not
 * already present. Any field the backup defines and the form does not is
 * appended as *archived* — hidden from new check-ins, but present so the
 * imported answers stay readable in History instead of being dropped on read.
 */
export async function importBackup(
  db: SQLiteDatabase,
  backup: BackupFile,
  mode: ImportMode
): Promise<ImportResult> {
  if (mode === 'replace') {
    await clearCollection(db, COLLECTIONS.entry);
    await clearCollection(db, COLLECTIONS.form);
    await saveForm(db, backup.form);

    await db.withTransactionAsync(async () => {
      for (const entry of backup.entries) {
        await putDoc(db, COLLECTIONS.entry, {
          id: entry.id,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          data: { values: entry.values },
        });
      }
    });

    for (const [key, value] of Object.entries(backup.settings)) {
      await setSetting(db, key, value);
    }

    return {
      mode,
      entriesAdded: backup.entries.length,
      entriesSkipped: 0,
      fieldsAdded: 0,
    };
  }

  const current = await loadForm(db);
  const knownFieldIds = new Set(current.fields.map((field) => field.id));
  const extraFields: FormField[] = backup.form.fields
    .filter((field) => !knownFieldIds.has(field.id))
    .map((field) => ({ ...field, archived: true }));

  if (extraFields.length > 0) {
    await saveForm(db, { ...current, fields: [...current.fields, ...extraFields] });
  }

  const existingIds = new Set(
    (await listDocs(db, COLLECTIONS.entry)).map((doc) => doc.id)
  );
  let entriesAdded = 0;
  let entriesSkipped = 0;

  await db.withTransactionAsync(async () => {
    for (const entry of backup.entries) {
      if (existingIds.has(entry.id)) {
        entriesSkipped += 1;
        continue;
      }
      await putDoc(db, COLLECTIONS.entry, {
        id: entry.id,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        data: { values: entry.values },
      });
      entriesAdded += 1;
    }
  });

  return { mode, entriesAdded, entriesSkipped, fieldsAdded: extraFields.length };
}

/**
 * Deletes every entry and the form definition.
 *
 * Reminder preferences in `settings` are left alone: they are scheduling
 * choices, not journal content, and wiping them would silently turn
 * notifications off. The form document going away is what sends the user back
 * through onboarding.
 */
export async function eraseEverything(db: SQLiteDatabase): Promise<void> {
  await clearCollection(db, COLLECTIONS.entry);
  await clearCollection(db, COLLECTIONS.form);
  // The pre-form `logs` table is kept as a migration safety net; a user asking
  // to erase everything means it too.
  await db.execAsync('DROP TABLE IF EXISTS logs');
}

/** Whether a form document exists, used to decide if there is anything to export. */
export async function hasAnythingToExport(db: SQLiteDatabase): Promise<boolean> {
  const form = await getDoc(db, COLLECTIONS.form, FORM_DOC_ID);
  const entries = await listDocs(db, COLLECTIONS.entry, { limit: 1 });
  return form !== null || entries.length > 0;
}
