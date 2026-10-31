/**
 * The user-defined form.
 *
 * Every field the Log tab renders comes from one of these definitions, so
 * adding a field is data, not code. The definitions live in a single document
 * (`COLLECTIONS.form`) and each saved check-in stores a `fieldId -> value` map
 * against them.
 *
 * Field ids are permanent: renaming a field keeps its id, so existing entries
 * keep their answers and a rename shows up retroactively in History. Deleting
 * a field archives it by default for the same reason — see `archived`.
 */

export const FIELD_KINDS = ['slider', 'words', 'text', 'datetime', 'yesno'] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

type FieldCommon = {
  /** Stable for the life of the field. Never reused, never renamed. */
  id: string;
  label: string;
  /** Explanatory line under the label. */
  help: string | null;
  /**
   * Optional section name. Consecutive fields sharing one group render inside
   * a single card, which is how "Mood" can hold both a slider and a word
   * without becoming two separate cards. Null means the field gets its own.
   */
  group: string | null;
  /**
   * Hidden from the form but still defined, so entries recorded before it was
   * removed keep rendering. The builder archives rather than deletes unless
   * the user explicitly asks to erase the answers too.
   */
  archived: boolean;
};

export type SliderField = FieldCommon & {
  kind: 'slider';
  min: number;
  max: number;
  /** Captions under the two ends of the track. */
  minLabel: string;
  maxLabel: string;
  /** Which end reads as "doing well" — drives colour and the trend direction. */
  goodEnd: 'high' | 'low';
  /** Plot this field as a line on Trends. */
  chart: boolean;
};

export type WordsField = FieldCommon & {
  kind: 'words';
  /** Suggestion chips offered above the input. */
  options: string[];
  /** Whether a word outside `options` can be typed in. */
  allowCustom: boolean;
  /**
   * Set together to make the suggestions follow another field's slider value:
   * the chips become `optionsByScore[String(sliderValue)]`. Used by the
   * starter form's mood and fatigue words; the builder leaves these alone.
   */
  linkedSliderId: string | null;
  optionsByScore: Record<string, string[]> | null;
};

export type TextField = FieldCommon & {
  kind: 'text';
  placeholder: string;
  /** Rough input height. 1 renders a single-line field. */
  lines: number;
  /** Small print under the input, e.g. a crisis-line reminder. */
  footnote: string | null;
};

export type DateTimeField = FieldCommon & {
  kind: 'datetime';
  /** Label on the picker button while nothing is chosen. */
  emptyLabel: string;
  /** Offer the most recent answer from an earlier entry as a one-tap reuse. */
  suggestPrevious: boolean;
};

export type YesNoField = FieldCommon & {
  kind: 'yesno';
  yesLabel: string;
  noLabel: string;
};

export type FormField =
  | SliderField
  | WordsField
  | TextField
  | DateTimeField
  | YesNoField;

export const FORM_DOC_ID = 'current';
export const FORM_SCHEMA_VERSION = 1;

export type FormDefinition = {
  schemaVersion: number;
  /** Ordered as rendered on the Log tab. Includes archived fields. */
  fields: FormField[];
};

/**
 * Fields that render together inside one card.
 *
 * The first field supplies the card's heading — the group name when grouped,
 * otherwise its own label — plus the explanatory subtitle. Every field after
 * the first shows its own label above its input.
 */
export type FieldGroup = {
  key: string;
  title: string;
  subtitle: string | null;
  fields: FormField[];
};

/**
 * What one field contributes to an entry:
 * slider -> number, words/text/datetime -> string, yesno -> boolean.
 */
export type FieldValue = number | string | boolean | null;

/** `fieldId -> value`. Unanswered fields are absent or null. */
export type EntryValues = Record<string, FieldValue>;

export type EntryData = {
  values: EntryValues;
};

/** Human-readable name for a field kind, used throughout the builder. */
export const KIND_LABELS: Record<FieldKind, string> = {
  slider: 'Slider',
  words: 'Word choice',
  text: 'Description',
  datetime: 'Date & time',
  yesno: 'Yes or no',
};

export const KIND_BLURBS: Record<FieldKind, string> = {
  slider: 'A number on a scale you define, like 0–10.',
  words: 'Pick a word from your own list, or write one.',
  text: 'Free writing — a sentence or a few paragraphs.',
  datetime: 'A moment in time, like when something last happened.',
  yesno: 'A simple yes or no.',
};
