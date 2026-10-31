import { FATIGUE_WORDS, MOOD_WORDS } from '../lib/mood';
import { FORM_SCHEMA_VERSION, type FormDefinition, type FormField } from './types';

/**
 * The form the app shipped with, now expressed as data.
 *
 * Field ids deliberately match the column names of the old `logs` table so
 * the migration is a straight rename, and so a user who upgrades sees exactly
 * the form they had before — only now they can change it.
 *
 * New users are offered this as a starting point during onboarding, or they
 * can begin from `blankForm()`.
 */

const SELF_HARM_FOOTNOTE =
  'If things feel urgent, call or text 988 (US & Canada) to reach a crisis counsellor right away.';

/** Word lists keyed by score, as the `optionsByScore` shape wants them. */
function byScore(words: Record<number, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(words).map(([score, list]) => [score, [...list]])
  );
}

const STARTER_FIELDS: FormField[] = [
  {
    id: 'mood_score',
    kind: 'slider',
    label: 'Mood',
    help: '0 is the worst you have felt, 10 the best.',
    group: 'Mood',
    archived: false,
    min: 0,
    max: 10,
    minLabel: 'Worst',
    maxLabel: 'Best',
    goodEnd: 'high',
    chart: true,
  },
  {
    id: 'mood_word',
    kind: 'words',
    label: 'A word for it',
    help: null,
    group: 'Mood',
    archived: false,
    options: [],
    allowCustom: true,
    linkedSliderId: 'mood_score',
    optionsByScore: byScore(MOOD_WORDS),
  },
  {
    id: 'fatigue_score',
    kind: 'slider',
    label: 'Fatigue',
    help: '0 is fully rested, 10 is an emotional or physical crash.',
    group: 'Fatigue',
    archived: false,
    min: 0,
    max: 10,
    minLabel: 'Rested',
    maxLabel: 'Crash',
    goodEnd: 'low',
    chart: true,
  },
  {
    id: 'fatigue_word',
    kind: 'words',
    label: 'A word for the tiredness',
    help: null,
    group: 'Fatigue',
    archived: false,
    options: [],
    allowCustom: true,
    linkedSliderId: 'fatigue_score',
    optionsByScore: byScore(FATIGUE_WORDS),
  },
  {
    id: 'fatigue_note',
    kind: 'text',
    label: 'Anything else about it',
    help: null,
    group: 'Fatigue',
    archived: false,
    placeholder: "Anything else about the tiredness? (optional)",
    lines: 2,
    footnote: null,
  },
  {
    id: 'lonely_at',
    kind: 'datetime',
    label: 'Loneliness',
    help: 'Last time you felt lonely.',
    group: 'Loneliness',
    archived: false,
    emptyLabel: 'Pick when you last felt lonely',
    suggestPrevious: true,
  },
  {
    id: 'lonely_note',
    kind: 'text',
    label: 'What it was like',
    help: null,
    group: 'Loneliness',
    archived: false,
    placeholder: 'Anything you want to add about it?',
    lines: 3,
    footnote: null,
  },
  {
    id: 'exercised',
    kind: 'yesno',
    label: 'Movement',
    help: 'Any exercise since your last log?',
    group: 'Movement',
    archived: false,
    yesLabel: 'Yes',
    noLabel: 'No',
  },
  {
    id: 'exercise_note',
    kind: 'text',
    label: 'What you did',
    help: null,
    group: 'Movement',
    archived: false,
    placeholder: 'What did you do, or what got in the way?',
    lines: 2,
    footnote: null,
  },
  {
    id: 'self_harm_thoughts',
    kind: 'text',
    label: 'Thoughts of self-harm',
    help: 'Anything recently, in your own words. Leave it blank if there is nothing.',
    group: null,
    archived: false,
    placeholder: 'What came up, and what it felt like',
    lines: 4,
    footnote: SELF_HARM_FOOTNOTE,
  },
  {
    id: 'last_vegetable_at',
    kind: 'datetime',
    label: 'Vegetables',
    help: 'Last time you ate a vegetable.',
    group: null,
    archived: false,
    emptyLabel: 'Pick when you last ate a vegetable',
    suggestPrevious: true,
  },
  {
    id: 'last_junk_food_at',
    kind: 'datetime',
    label: 'Junk food',
    help: "Last time you ate fast food or anything you'd call junk — tracked only to show how often it happens.",
    group: 'Junk food',
    archived: false,
    emptyLabel: 'Pick when you last ate junk food',
    suggestPrevious: true,
  },
  {
    id: 'junk_food_note',
    kind: 'text',
    label: 'What it was',
    help: null,
    group: 'Junk food',
    archived: false,
    placeholder: 'What was it? (optional)',
    lines: 2,
    footnote: null,
  },
  {
    id: 'last_processed_sugar_at',
    kind: 'datetime',
    label: 'Processed sugar',
    help: 'Last time you had added sugar — full-sugar soda, cake, candy, sweetened coffee. Sugar from whole fruit does not count.',
    group: 'Processed sugar',
    archived: false,
    emptyLabel: 'Pick when you last had processed sugar',
    suggestPrevious: true,
  },
  {
    id: 'processed_sugar_note',
    kind: 'text',
    label: 'What it was',
    help: null,
    group: 'Processed sugar',
    archived: false,
    placeholder: 'What was it? (optional)',
    lines: 2,
    footnote: null,
  },
];

/** Deep copy, so callers can edit the result without touching the template. */
export function starterForm(): FormDefinition {
  return {
    schemaVersion: FORM_SCHEMA_VERSION,
    fields: STARTER_FIELDS.map((field) => ({ ...field })),
  };
}

export function blankForm(): FormDefinition {
  return { schemaVersion: FORM_SCHEMA_VERSION, fields: [] };
}

/** Starting points offered during onboarding. */
export const STARTER_CHOICES = [
  {
    key: 'starter',
    title: 'The full check-in',
    blurb:
      'Mood, fatigue, loneliness, movement, self-harm thoughts, and three food habits. Fifteen fields — edit or remove any of them later.',
    build: starterForm,
  },
  {
    key: 'minimal',
    title: 'Just mood',
    blurb: 'A 0–10 mood slider, a word for how you feel, and a free-text note. Three fields.',
    build: minimalForm,
  },
  {
    key: 'blank',
    title: 'Start from scratch',
    blurb: 'An empty form. You add every field yourself.',
    build: blankForm,
  },
] as const;

function minimalForm(): FormDefinition {
  const keep = new Set(['mood_score', 'mood_word']);
  return {
    schemaVersion: FORM_SCHEMA_VERSION,
    fields: [
      ...STARTER_FIELDS.filter((field) => keep.has(field.id)).map((field) => ({ ...field })),
      {
        id: 'mood_note',
        kind: 'text',
        label: 'Anything you want to remember',
        help: null,
        group: 'Mood',
        archived: false,
        placeholder: 'What happened today?',
        lines: 4,
        footnote: null,
      },
    ],
  };
}
