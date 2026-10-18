/** A single mood log. Every tracked field is optional by design. */
export type MoodLog = {
  id: number;
  createdAt: string;
  updatedAt: string;
  moodScore: number | null;
  moodWord: string | null;
  lonelyAt: string | null;
  lonelyNote: string | null;
  /** 1 = yes, 0 = no, null = not answered */
  exercised: number | null;
  exerciseNote: string | null;
  selfHarmThoughts: string | null;
  fatigueScore: number | null;
  fatigueWord: string | null;
  fatigueNote: string | null;
  lastVegetableAt: string | null;
  lastJunkFoodAt: string | null;
  junkFoodNote: string | null;
  lastProcessedSugarAt: string | null;
  processedSugarNote: string | null;
};

/** Everything a user can fill in; `createdAt` defaults to now on insert. */
export type MoodLogDraft = Omit<MoodLog, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt?: string;
};

export type MoodLogRow = {
  id: number;
  created_at: string;
  updated_at: string;
  mood_score: number | null;
  mood_word: string | null;
  lonely_at: string | null;
  lonely_note: string | null;
  exercised: number | null;
  exercise_note: string | null;
  self_harm_thoughts: string | null;
  fatigue_score: number | null;
  fatigue_word: string | null;
  fatigue_note: string | null;
  last_vegetable_at: string | null;
  last_junk_food_at: string | null;
  junk_food_note: string | null;
  last_processed_sugar_at: string | null;
  processed_sugar_note: string | null;
};

export const emptyDraft = (): MoodLogDraft => ({
  moodScore: null,
  moodWord: null,
  lonelyAt: null,
  lonelyNote: null,
  exercised: null,
  exerciseNote: null,
  selfHarmThoughts: null,
  fatigueScore: null,
  fatigueWord: null,
  fatigueNote: null,
  lastVegetableAt: null,
  lastJunkFoodAt: null,
  junkFoodNote: null,
  lastProcessedSugarAt: null,
  processedSugarNote: null,
});

export function rowToLog(row: MoodLogRow): MoodLog {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    moodScore: row.mood_score,
    moodWord: row.mood_word,
    lonelyAt: row.lonely_at,
    lonelyNote: row.lonely_note,
    exercised: row.exercised,
    exerciseNote: row.exercise_note,
    selfHarmThoughts: row.self_harm_thoughts,
    fatigueScore: row.fatigue_score,
    fatigueWord: row.fatigue_word,
    fatigueNote: row.fatigue_note,
    lastVegetableAt: row.last_vegetable_at,
    lastJunkFoodAt: row.last_junk_food_at,
    junkFoodNote: row.junk_food_note,
    lastProcessedSugarAt: row.last_processed_sugar_at,
    processedSugarNote: row.processed_sugar_note,
  };
}

/** True when a draft has nothing worth saving. */
export function isDraftEmpty(draft: MoodLogDraft): boolean {
  return (
    draft.moodScore === null &&
    draft.fatigueScore === null &&
    draft.exercised === null &&
    draft.lonelyAt === null &&
    draft.lastVegetableAt === null &&
    draft.lastJunkFoodAt === null &&
    draft.lastProcessedSugarAt === null &&
    !draft.moodWord?.trim() &&
    !draft.lonelyNote?.trim() &&
    !draft.exerciseNote?.trim() &&
    !draft.selfHarmThoughts?.trim() &&
    !draft.fatigueWord?.trim() &&
    !draft.fatigueNote?.trim() &&
    !draft.junkFoodNote?.trim() &&
    !draft.processedSugarNote?.trim()
  );
}
