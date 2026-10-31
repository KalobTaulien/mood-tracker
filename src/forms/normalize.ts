import {
  FIELD_KINDS,
  FORM_SCHEMA_VERSION,
  type EntryData,
  type EntryValues,
  type FieldGroup,
  type FieldKind,
  type FormDefinition,
  type FormField,
} from './types';
import { coerceValue } from './values';

/**
 * Turns untrusted JSON into a usable form definition or entry.
 *
 * Documents come from three places that can all disagree with the current
 * code: this build, an older build, and an imported backup file. Rather than
 * version-gating every read, each value is coerced to something sane and
 * anything unsalvageable is dropped. A single bad field can never take a
 * screen down with it.
 */

/** Guard rails so a malformed or hostile backup cannot produce an unusable app. */
const LIMITS = {
  label: 80,
  help: 300,
  placeholder: 120,
  options: 40,
  optionLength: 60,
  fields: 80,
  /** Widest slider scale allowed, so the track stays renderable. */
  span: 1000,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback: string, max: number): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length ? trimmed : fallback;
}

function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length ? trimmed : null;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function integer(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? Math.round(num) : fallback;
}

function wordList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const word = optionalText(item, LIMITS.optionLength);
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
    if (out.length >= LIMITS.options) break;
  }
  return out;
}

/** Only kept when shaped as `{ "<score>": ["word", ...] }`. */
function wordsByScore(value: unknown): Record<string, string[]> | null {
  if (!isRecord(value)) return null;
  const out: Record<string, string[]> = {};
  for (const [score, words] of Object.entries(value)) {
    if (!/^-?\d+$/.test(score)) continue;
    const list = wordList(words);
    if (list.length) out[score] = list;
  }
  return Object.keys(out).length ? out : null;
}

function isFieldKind(value: unknown): value is FieldKind {
  return typeof value === 'string' && (FIELD_KINDS as readonly string[]).includes(value);
}

export function normalizeField(raw: unknown): FormField | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || raw.id.trim().length === 0) return null;
  if (!isFieldKind(raw.kind)) return null;

  const common = {
    id: raw.id.trim(),
    label: text(raw.label, 'Untitled', LIMITS.label),
    help: optionalText(raw.help, LIMITS.help),
    group: optionalText(raw.group, LIMITS.label),
    archived: flag(raw.archived, false),
  };

  switch (raw.kind) {
    case 'slider': {
      let min = integer(raw.min, 0);
      let max = integer(raw.max, 10);
      if (max <= min) {
        min = 0;
        max = 10;
      }
      if (max - min > LIMITS.span) max = min + LIMITS.span;
      return {
        ...common,
        kind: 'slider',
        min,
        max,
        minLabel: text(raw.minLabel, 'Low', LIMITS.label),
        maxLabel: text(raw.maxLabel, 'High', LIMITS.label),
        goodEnd: raw.goodEnd === 'low' ? 'low' : 'high',
        chart: flag(raw.chart, true),
      };
    }
    case 'words': {
      const optionsByScore = wordsByScore(raw.optionsByScore);
      const linkedSliderId =
        optionsByScore && typeof raw.linkedSliderId === 'string'
          ? raw.linkedSliderId.trim() || null
          : null;
      return {
        ...common,
        kind: 'words',
        options: wordList(raw.options),
        allowCustom: flag(raw.allowCustom, true),
        linkedSliderId,
        optionsByScore: linkedSliderId ? optionsByScore : null,
      };
    }
    case 'text':
      return {
        ...common,
        kind: 'text',
        placeholder: text(raw.placeholder, 'Write as much or as little as you like', LIMITS.placeholder),
        lines: Math.max(1, Math.min(10, integer(raw.lines, 3))),
        footnote: optionalText(raw.footnote, LIMITS.help),
      };
    case 'datetime':
      return {
        ...common,
        kind: 'datetime',
        emptyLabel: text(raw.emptyLabel, 'Pick a date & time', LIMITS.placeholder),
        suggestPrevious: flag(raw.suggestPrevious, true),
      };
    case 'yesno':
      return {
        ...common,
        kind: 'yesno',
        yesLabel: text(raw.yesLabel, 'Yes', LIMITS.label),
        noLabel: text(raw.noLabel, 'No', LIMITS.label),
      };
  }
}

export function normalizeForm(raw: unknown): FormDefinition {
  const rawFields = isRecord(raw) && Array.isArray(raw.fields) ? raw.fields : [];
  const seen = new Set<string>();
  const fields: FormField[] = [];

  for (const candidate of rawFields) {
    const field = normalizeField(candidate);
    // First definition wins, so a duplicated id cannot shadow a live field.
    if (!field || seen.has(field.id)) continue;
    seen.add(field.id);
    fields.push(field);
    if (fields.length >= LIMITS.fields) break;
  }

  // A words field pointing at a slider that no longer exists falls back to its
  // own flat option list rather than silently showing no suggestions at all.
  const sliderIds = new Set(
    fields.filter((field) => field.kind === 'slider').map((field) => field.id)
  );

  return {
    schemaVersion: FORM_SCHEMA_VERSION,
    fields: fields.map((field) =>
      field.kind === 'words' && field.linkedSliderId && !sliderIds.has(field.linkedSliderId)
        ? { ...field, linkedSliderId: null, optionsByScore: null }
        : field
    ),
  };
}

/**
 * Reads an entry's answers against the current form.
 *
 * Values for fields the form no longer defines are dropped: without a
 * definition there is no way to render or interpret them. The builder only
 * reaches that state when the user explicitly chose to erase a field's data.
 */
export function normalizeEntryData(raw: unknown, fields: readonly FormField[]): EntryData {
  const rawValues = isRecord(raw) && isRecord(raw.values) ? raw.values : {};
  const values: EntryValues = {};

  for (const field of fields) {
    const value = coerceValue(field, rawValues[field.id]);
    if (value !== null) values[field.id] = value;
  }

  return { values };
}

/**
 * Splits fields into cards: consecutive fields sharing a non-null `group` land
 * in the same one, and an ungrouped field gets a card to itself.
 */
export function groupFields(fields: readonly FormField[]): FieldGroup[] {
  const groups: FieldGroup[] = [];

  for (const field of fields) {
    const last = groups[groups.length - 1];
    if (field.group && last && last.key === `group:${field.group}`) {
      last.fields.push(field);
      continue;
    }
    groups.push({
      key: field.group ? `group:${field.group}` : `field:${field.id}`,
      title: field.group ?? field.label,
      subtitle: field.help,
      fields: [field],
    });
  }

  return groups;
}
