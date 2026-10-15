import { dayKey, dayKeysForRange, fromIso } from './dates';
import type { MoodLog } from '../db/types';

export type DayPoint = {
  /** Local day key, e.g. "2026-10-15" */
  day: string;
  /** Index into the range, 0 = oldest day shown */
  index: number;
  mood: number | null;
  fatigue: number | null;
  logCount: number;
};

export type Summary = {
  avgMood: number | null;
  avgFatigue: number | null;
  minMood: number | null;
  maxMood: number | null;
  daysLogged: number;
  totalLogs: number;
  exerciseYes: number;
  exerciseAnswered: number;
  lonelyMentions: number;
  selfHarmMentions: number;
  /** Day-over-day mood direction across the window, comparing first and second half. */
  moodTrend: number | null;
};

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Buckets logs into one point per local day, with nulls on days that have no score. */
export function buildDailySeries(logs: MoodLog[], days: number): DayPoint[] {
  const keys = dayKeysForRange(days);
  const buckets = new Map<string, { mood: number[]; fatigue: number[]; count: number }>();
  for (const key of keys) buckets.set(key, { mood: [], fatigue: [], count: 0 });

  for (const log of logs) {
    const created = fromIso(log.createdAt);
    if (!created) continue;
    const bucket = buckets.get(dayKey(created));
    if (!bucket) continue;
    bucket.count += 1;
    if (log.moodScore !== null) bucket.mood.push(log.moodScore);
    if (log.fatigueScore !== null) bucket.fatigue.push(log.fatigueScore);
  }

  return keys.map((day, index) => {
    const bucket = buckets.get(day)!;
    return {
      day,
      index,
      mood: mean(bucket.mood),
      fatigue: mean(bucket.fatigue),
      logCount: bucket.count,
    };
  });
}

export function summarize(logs: MoodLog[], series: DayPoint[]): Summary {
  const moods = logs.map((l) => l.moodScore).filter((v): v is number => v !== null);
  const fatigues = logs.map((l) => l.fatigueScore).filter((v): v is number => v !== null);
  const answered = logs.filter((l) => l.exercised !== null);

  const withMood = series.filter((p) => p.mood !== null);
  const half = Math.floor(withMood.length / 2);
  const firstHalf = mean(withMood.slice(0, half).map((p) => p.mood!));
  const secondHalf = mean(withMood.slice(half).map((p) => p.mood!));
  const moodTrend =
    firstHalf !== null && secondHalf !== null && withMood.length >= 4
      ? secondHalf - firstHalf
      : null;

  return {
    avgMood: mean(moods),
    avgFatigue: mean(fatigues),
    minMood: moods.length ? Math.min(...moods) : null,
    maxMood: moods.length ? Math.max(...moods) : null,
    daysLogged: series.filter((p) => p.logCount > 0).length,
    totalLogs: logs.length,
    exerciseYes: answered.filter((l) => l.exercised === 1).length,
    exerciseAnswered: answered.length,
    lonelyMentions: logs.filter((l) => l.lonelyAt !== null).length,
    selfHarmMentions: logs.filter((l) => !!l.selfHarmThoughts?.trim()).length,
    moodTrend,
  };
}

/** Contiguous runs of non-null values, so the chart breaks the line across gaps. */
export function segmentsOf(
  series: DayPoint[],
  pick: (point: DayPoint) => number | null
): { index: number; value: number }[][] {
  const segments: { index: number; value: number }[][] = [];
  let current: { index: number; value: number }[] = [];

  for (const point of series) {
    const value = pick(point);
    if (value === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push({ index: point.index, value });
    }
  }
  if (current.length) segments.push(current);
  return segments;
}
