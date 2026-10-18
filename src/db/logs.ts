import type { SQLiteDatabase } from 'expo-sqlite';
import { nowIso } from '../lib/dates';
import { rowToLog, type MoodLog, type MoodLogDraft, type MoodLogRow } from './types';

const SELECT_COLUMNS = `
  id, created_at, updated_at, mood_score, mood_word, lonely_at, lonely_note,
  exercised, exercise_note, self_harm_thoughts, fatigue_score, fatigue_word,
  fatigue_note, last_vegetable_at, last_junk_food_at, junk_food_note,
  last_processed_sugar_at, processed_sugar_note
`;

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function insertLog(db: SQLiteDatabase, draft: MoodLogDraft): Promise<number> {
  const createdAt = draft.createdAt ?? nowIso();
  const result = await db.runAsync(
    `INSERT INTO logs (
       created_at, updated_at, mood_score, mood_word, lonely_at, lonely_note,
       exercised, exercise_note, self_harm_thoughts, fatigue_score, fatigue_word,
       fatigue_note, last_vegetable_at, last_junk_food_at, junk_food_note,
       last_processed_sugar_at, processed_sugar_note
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      createdAt,
      createdAt,
      draft.moodScore,
      trimOrNull(draft.moodWord),
      draft.lonelyAt,
      trimOrNull(draft.lonelyNote),
      draft.exercised,
      trimOrNull(draft.exerciseNote),
      trimOrNull(draft.selfHarmThoughts),
      draft.fatigueScore,
      trimOrNull(draft.fatigueWord),
      trimOrNull(draft.fatigueNote),
      draft.lastVegetableAt,
      draft.lastJunkFoodAt,
      trimOrNull(draft.junkFoodNote),
      draft.lastProcessedSugarAt,
      trimOrNull(draft.processedSugarNote),
    ]
  );
  return result.lastInsertRowId;
}

export async function updateLog(
  db: SQLiteDatabase,
  id: number,
  draft: MoodLogDraft
): Promise<void> {
  await db.runAsync(
    `UPDATE logs SET
       updated_at = ?, mood_score = ?, mood_word = ?, lonely_at = ?, lonely_note = ?,
       exercised = ?, exercise_note = ?, self_harm_thoughts = ?, fatigue_score = ?,
       fatigue_word = ?, fatigue_note = ?, last_vegetable_at = ?,
       last_junk_food_at = ?, junk_food_note = ?,
       last_processed_sugar_at = ?, processed_sugar_note = ?
     WHERE id = ?`,
    [
      nowIso(),
      draft.moodScore,
      trimOrNull(draft.moodWord),
      draft.lonelyAt,
      trimOrNull(draft.lonelyNote),
      draft.exercised,
      trimOrNull(draft.exerciseNote),
      trimOrNull(draft.selfHarmThoughts),
      draft.fatigueScore,
      trimOrNull(draft.fatigueWord),
      trimOrNull(draft.fatigueNote),
      draft.lastVegetableAt,
      draft.lastJunkFoodAt,
      trimOrNull(draft.junkFoodNote),
      draft.lastProcessedSugarAt,
      trimOrNull(draft.processedSugarNote),
      id,
    ]
  );
}

export async function deleteLog(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM logs WHERE id = ?', [id]);
}

export async function getLog(db: SQLiteDatabase, id: number): Promise<MoodLog | null> {
  const row = await db.getFirstAsync<MoodLogRow>(
    `SELECT ${SELECT_COLUMNS} FROM logs WHERE id = ?`,
    [id]
  );
  return row ? rowToLog(row) : null;
}

export async function listLogs(db: SQLiteDatabase, limit = 200): Promise<MoodLog[]> {
  const rows = await db.getAllAsync<MoodLogRow>(
    `SELECT ${SELECT_COLUMNS} FROM logs ORDER BY created_at DESC, id DESC LIMIT ?`,
    [limit]
  );
  return rows.map(rowToLog);
}

/** Logs created at or after `startIso`, oldest first — the shape charts want. */
export async function listLogsSince(db: SQLiteDatabase, startIso: string): Promise<MoodLog[]> {
  const rows = await db.getAllAsync<MoodLogRow>(
    `SELECT ${SELECT_COLUMNS} FROM logs WHERE created_at >= ? ORDER BY created_at ASC, id ASC`,
    [startIso]
  );
  return rows.map(rowToLog);
}

export async function countLogs(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM logs');
  return row?.count ?? 0;
}

/** Most recent non-null value for a datetime column, for "last time I…" prefills. */
export async function latestTimestamp(
  db: SQLiteDatabase,
  column:
    | 'lonely_at'
    | 'last_vegetable_at'
    | 'last_junk_food_at'
    | 'last_processed_sugar_at'
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>(
    `SELECT MAX(${column}) AS value FROM logs WHERE ${column} IS NOT NULL`
  );
  return row?.value ?? null;
}
