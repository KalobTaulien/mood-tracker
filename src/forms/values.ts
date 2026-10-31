import { formatDateTime, fromIso } from '../lib/dates';
import type {
  EntryValues,
  FieldValue,
  FormField,
  SliderField,
  TextField,
  WordsField,
} from './types';

/**
 * Reading and interpreting the values stored against a user-defined field.
 *
 * Everything here has to survive values written by an older build of the app
 * or pasted in from a backup file, so each coercion takes `unknown` and
 * returns either a value valid for that field or null. Nothing throws.
 */

export function isBlank(value: FieldValue | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  return false;
}

function clampSlider(field: SliderField, raw: number): number {
  return Math.max(field.min, Math.min(field.max, Math.round(raw)));
}

/** Coerces a stored or imported value into something valid for `field`. */
export function coerceValue(field: FormField, raw: unknown): FieldValue {
  if (raw === null || raw === undefined) return null;

  switch (field.kind) {
    case 'slider': {
      const num = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(num)) return null;
      return clampSlider(field, num);
    }
    case 'words':
    case 'text': {
      if (typeof raw !== 'string') return null;
      const trimmed = raw.trim();
      return trimmed.length ? trimmed : null;
    }
    case 'datetime': {
      if (typeof raw !== 'string') return null;
      const date = fromIso(raw);
      return date ? date.toISOString() : null;
    }
    case 'yesno': {
      if (typeof raw === 'boolean') return raw;
      // Legacy rows and hand-edited backups store 1/0 or "yes"/"no".
      if (typeof raw === 'number') return raw === 0 ? false : raw === 1 ? true : null;
      if (typeof raw === 'string') {
        const lower = raw.trim().toLowerCase();
        if (lower === 'true' || lower === 'yes' || lower === '1') return true;
        if (lower === 'false' || lower === 'no' || lower === '0') return false;
      }
      return null;
    }
  }
}

/** True when nothing in the entry is worth saving. */
export function isEntryEmpty(values: EntryValues): boolean {
  return Object.values(values).every(isBlank);
}

/** Drops blanks, so a document only carries answers the user actually gave. */
export function pruneValues(values: EntryValues): EntryValues {
  const out: EntryValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (!isBlank(value)) out[key] = value;
  }
  return out;
}

export function countAnswered(values: EntryValues): number {
  return Object.values(values).filter((value) => !isBlank(value)).length;
}

/**
 * Where `value` sits on the field's scale, as 0..1 with 1 always being the
 * "doing well" end. Used for colour, so a low-is-good slider like fatigue
 * tints the same way a high-is-good one does.
 */
export function sliderGoodness(field: SliderField, value: number): number {
  const span = field.max - field.min;
  if (span <= 0) return 0.5;
  const ratio = (value - field.min) / span;
  const clamped = Math.max(0, Math.min(1, ratio));
  return field.goodEnd === 'low' ? 1 - clamped : clamped;
}

/** The suggestion chips to show for a word field, given the rest of the entry. */
export function suggestionsFor(field: WordsField, values: EntryValues): string[] {
  if (field.linkedSliderId && field.optionsByScore) {
    const score = values[field.linkedSliderId];
    if (typeof score !== 'number') return [];
    return field.optionsByScore[String(score)] ?? [];
  }
  return field.options;
}

/** One-line rendering of an answer, for History rows and summaries. */
export function describeValue(field: FormField, value: FieldValue): string | null {
  if (isBlank(value)) return null;

  switch (field.kind) {
    case 'slider':
      return typeof value === 'number' ? `${value}` : null;
    case 'words':
    case 'text':
      return typeof value === 'string' ? value : null;
    case 'datetime':
      return typeof value === 'string' ? formatDateTime(value) : null;
    case 'yesno':
      if (typeof value !== 'boolean') return null;
      return value ? field.yesLabel : field.noLabel;
  }
}

/**
 * Which fields to render for an existing entry.
 *
 * Archived fields are hidden from new check-ins but shown here when this
 * entry actually has an answer for one, so an old answer stays visible — and
 * clearable — instead of becoming invisible but still stored.
 */
export function fieldsForEntry(
  fields: readonly FormField[],
  values: EntryValues
): FormField[] {
  return fields.filter((field) => !field.archived || !isBlank(values[field.id]));
}

/** Short tags summarising which fields an entry carries, for History rows. */
export function summaryTags(
  fields: readonly FormField[],
  values: EntryValues,
  options: { skipFieldIds?: readonly string[] } = {}
): string[] {
  const skip = new Set(options.skipFieldIds ?? []);
  const tags: string[] = [];

  for (const field of fields) {
    if (skip.has(field.id)) continue;
    const value = values[field.id];
    if (isBlank(value)) continue;

    switch (field.kind) {
      case 'slider':
        tags.push(`${field.label.toLowerCase()} ${value}`);
        break;
      case 'words':
        tags.push(String(value).toLowerCase());
        break;
      case 'yesno':
        tags.push(value === true ? field.label.toLowerCase() : `no ${field.label.toLowerCase()}`);
        break;
      case 'datetime':
      case 'text':
        tags.push(field.label.toLowerCase());
        break;
    }
  }

  return tags;
}

/**
 * The field a History row leads with.
 *
 * With a user-defined form there is no guaranteed "mood" field, so the row
 * picks the first slider for its score badge and the first word field for its
 * headline — falling back to a text field when the form has no words. For the
 * starter form that resolves to mood and its word, which is what it used to
 * hard-code.
 */
export function leadFields(fields: readonly FormField[]): {
  slider: SliderField | null;
  headline: WordsField | TextField | null;
} {
  const live = fields.filter((field) => !field.archived);
  const slider = live.find((field): field is SliderField => field.kind === 'slider') ?? null;
  const headline =
    live.find((field): field is WordsField => field.kind === 'words') ??
    live.find((field): field is TextField => field.kind === 'text') ??
    null;
  return { slider, headline };
}
