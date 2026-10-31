import type { Entry } from '../store/entries';
import {
  isBlank,
  sliderGoodness,
  type EntryValues,
  type FormField,
  type SliderField,
} from '../forms';
import { dayKey, dayKeysForRange, fromIso } from './dates';

/**
 * Trend maths over a user-defined form.
 *
 * Nothing here knows about "mood" or "fatigue". Every slider in the form can
 * be charted and summarised, and the non-slider kinds each get the summary
 * that suits them — a yes/no field counts answers, a date field counts
 * distinct moments, a word field reports its most-used words.
 */

export type ChartSeries = {
  field: SliderField;
  /** One entry per day in the range, oldest first. Null where nothing was logged. */
  values: (number | null)[];
};

export type DailyData = {
  /** Local day keys, oldest first. */
  days: string[];
  /** Entries recorded on each day. */
  counts: number[];
  series: ChartSeries[];
};

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Buckets entries into one point per local day, averaging within a day.
 *
 * Days with no entry stay null rather than being interpolated, so the chart
 * can break the line across a gap instead of inventing a value.
 */
export function buildDailyData(
  entries: readonly Entry[],
  sliders: readonly SliderField[],
  days: number
): DailyData {
  const dayList = dayKeysForRange(days);
  const index = new Map(dayList.map((day, i) => [day, i]));
  const counts = dayList.map(() => 0);
  const buckets = sliders.map(() => dayList.map((): number[] => []));

  for (const entry of entries) {
    const created = fromIso(entry.createdAt);
    if (!created) continue;
    const i = index.get(dayKey(created));
    if (i === undefined) continue;

    counts[i] += 1;
    sliders.forEach((field, s) => {
      const value = entry.values[field.id];
      if (typeof value === 'number') buckets[s][i].push(value);
    });
  }

  return {
    days: dayList,
    counts,
    series: sliders.map((field, s) => ({
      field,
      values: buckets[s].map((values) => mean(values)),
    })),
  };
}

export type SliderSummary = {
  field: SliderField;
  average: number | null;
  min: number | null;
  max: number | null;
  /** Raw change between the earlier and later half of the window. */
  delta: number | null;
  /** Whether `delta` is movement in the good direction, honouring `goodEnd`. */
  improving: boolean | null;
};

export type HabitSummary =
  | { kind: 'yesno'; field: FormField; yes: number; answered: number }
  | { kind: 'datetime'; field: FormField; events: number }
  | { kind: 'text'; field: FormField; entries: number }
  | { kind: 'words'; field: FormField; top: { word: string; count: number }[] };

export type Summary = {
  totalEntries: number;
  daysLogged: number;
  sliders: SliderSummary[];
  habits: HabitSummary[];
};

/**
 * Counts distinct moments that land on a day inside the window.
 *
 * The same moment can be re-recorded across several entries (the "Reuse" hint
 * does exactly that), and the moment itself can predate the window even when
 * the entry is recent — so dedupe by value and filter on the recorded time,
 * not the entry's.
 */
function distinctEventsInWindow(
  values: readonly (string | null)[],
  windowDays: Set<string>
): number {
  const seen = new Set<string>();
  for (const value of values) {
    const at = fromIso(value);
    if (!at || !windowDays.has(dayKey(at))) continue;
    seen.add(value!);
  }
  return seen.size;
}

/**
 * Human-readable cadence for `count` events across `days` days, e.g.
 * "≈ 2.3× per week" or "≈ every 9 days". Null when nothing happened.
 */
export function frequencyHint(count: number, days: number): string | null {
  if (count <= 0 || days <= 0) return null;
  const perWeek = (count / days) * 7;
  if (perWeek >= 1) return `≈ ${perWeek.toFixed(1)}× per week`;
  return `≈ every ${Math.round(days / count)} days`;
}

function summarizeSlider(
  field: SliderField,
  entries: readonly Entry[],
  series: ChartSeries | undefined
): SliderSummary {
  const values = entries
    .map((entry) => entry.values[field.id])
    .filter((value): value is number => typeof value === 'number');

  // The trend compares daily averages rather than raw entries, so a day with
  // six logs does not outweigh a day with one.
  const daily = (series?.values ?? []).filter((value): value is number => value !== null);
  const half = Math.floor(daily.length / 2);
  const earlier = mean(daily.slice(0, half));
  const later = mean(daily.slice(half));
  const enough = daily.length >= 4 && earlier !== null && later !== null;

  const delta = enough ? later - earlier : null;
  const improving =
    delta === null
      ? null
      : field.goodEnd === 'high'
        ? delta >= 0
        : delta <= 0;

  return {
    field,
    average: mean(values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    delta,
    improving,
  };
}

function topWords(
  entries: readonly Entry[],
  fieldId: string
): { word: string; count: number }[] {
  const counts = new Map<string, { word: string; count: number }>();
  for (const entry of entries) {
    const value = entry.values[fieldId];
    if (typeof value !== 'string' || !value.trim()) continue;
    const key = value.trim().toLowerCase();
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { word: value.trim(), count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 3);
}

export function summarize(
  fields: readonly FormField[],
  entries: readonly Entry[],
  data: DailyData
): Summary {
  const windowDays = new Set(data.days);
  const seriesByField = new Map(data.series.map((item) => [item.field.id, item]));
  const sliders: SliderSummary[] = [];
  const habits: HabitSummary[] = [];

  for (const field of fields) {
    switch (field.kind) {
      case 'slider':
        sliders.push(summarizeSlider(field, entries, seriesByField.get(field.id)));
        break;
      case 'yesno': {
        const answers = entries
          .map((entry) => entry.values[field.id])
          .filter((value): value is boolean => typeof value === 'boolean');
        habits.push({
          kind: 'yesno',
          field,
          yes: answers.filter(Boolean).length,
          answered: answers.length,
        });
        break;
      }
      case 'datetime':
        habits.push({
          kind: 'datetime',
          field,
          events: distinctEventsInWindow(
            entries.map((entry) => {
              const value = entry.values[field.id];
              return typeof value === 'string' ? value : null;
            }),
            windowDays
          ),
        });
        break;
      case 'text':
        habits.push({
          kind: 'text',
          field,
          entries: entries.filter((entry) => !isBlank(entry.values[field.id])).length,
        });
        break;
      case 'words':
        habits.push({ kind: 'words', field, top: topWords(entries, field.id) });
        break;
    }
  }

  return {
    totalEntries: entries.length,
    daysLogged: data.counts.filter((count) => count > 0).length,
    sliders,
    habits,
  };
}

/** Contiguous runs of non-null values, so the chart breaks the line across gaps. */
export function segmentsOf(
  values: readonly (number | null)[]
): { index: number; value: number }[][] {
  const segments: { index: number; value: number }[][] = [];
  let current: { index: number; value: number }[] = [];

  values.forEach((value, index) => {
    if (value === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push({ index, value });
    }
  });
  if (current.length) segments.push(current);
  return segments;
}

/** Normalized 0..1 position of a value where 1 is always the good end. */
export function goodnessOf(field: SliderField, value: number): number {
  return sliderGoodness(field, value);
}

/** True when nothing in `values` has been answered for any of `fields`. */
export function hasAnyAnswer(
  fields: readonly FormField[],
  values: EntryValues
): boolean {
  return fields.some((field) => !isBlank(values[field.id]));
}
