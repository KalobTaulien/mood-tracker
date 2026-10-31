import type { SQLiteDatabase } from 'expo-sqlite';
import { nowIso } from '../lib/dates';
import { blankForm, normalizeForm, type FormDefinition } from '../forms';
import { FORM_DOC_ID } from '../forms/types';
import { COLLECTIONS, getDoc, putDoc } from './docs';

/** Reads the form definition, normalizing whatever is on disk. */
export async function loadForm(db: SQLiteDatabase): Promise<FormDefinition> {
  const doc = await getDoc(db, COLLECTIONS.form, FORM_DOC_ID);
  // A missing document means onboarding has not run yet; an unreadable one
  // means the JSON was corrupted. Either way an empty form is safe to render,
  // and the builder can repair it.
  return doc ? normalizeForm(doc.data) : blankForm();
}

export async function saveForm(db: SQLiteDatabase, form: FormDefinition): Promise<void> {
  const existing = await getDoc(db, COLLECTIONS.form, FORM_DOC_ID);
  const now = nowIso();
  await putDoc(db, COLLECTIONS.form, {
    id: FORM_DOC_ID,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    data: normalizeForm(form),
  });
}

/** Whether a form has ever been saved — the signal that onboarding is done. */
export async function hasForm(db: SQLiteDatabase): Promise<boolean> {
  return (await getDoc(db, COLLECTIONS.form, FORM_DOC_ID)) !== null;
}
