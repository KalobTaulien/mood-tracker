/** Suggested words per mood score. Free text is always allowed instead. */
export const MOOD_WORDS: Record<number, string[]> = {
  0: ['Numb', 'Empty', 'Hopeless', 'Void', 'Blank', 'Lifeless'],
  1: ['Crushed', 'Despairing', 'Bleak', 'Wrecked', 'Broken', 'Anguished'],
  2: ['Awful', 'Sinking', 'Raw', 'Miserable', 'Hurting', 'Dark'],
  3: ['Low', 'Heavy', 'Discouraged', 'Glum', 'Sad', 'Weighed down'],
  4: ['Flat', 'Drained', 'Meh', 'Dull', 'Off', 'Blah'],
  5: ['Neutral', 'Okay', 'Even', 'Middling', 'Plain', 'Indifferent'],
  6: ['Steady', 'Fine', 'Settled', 'Stable', 'Alright', 'Calm'],
  7: ['Good', 'Lifted', 'Content', 'Pleased', 'Easy', 'Upbeat'],
  8: ['Happy', 'Bright', 'Warm', 'Cheerful', 'Buoyant', 'Grateful'],
  9: ['Great', 'Energized', 'Glad', 'Joyful', 'Thriving', 'Excited'],
  10: ['Elated', 'Radiant', 'Alive', 'Euphoric', 'Overjoyed', 'Soaring'],
};

/** Suggested words per fatigue score, 0 = fully rested, 10 = full crash. */
export const FATIGUE_WORDS: Record<number, string[]> = {
  0: ['Fully rested', 'Recharged', 'Wide awake', 'Restored', 'Renewed', 'Brimming'],
  1: ['Fresh', 'Alert', 'Lively', 'Well slept', 'Ready', 'Easy'],
  2: ['Mostly fine', 'Steady', 'Comfortable', 'Normal', 'Holding up', 'Unbothered'],
  3: ['Slightly tired', 'Yawning', 'A bit flat', 'Slowing', 'Low gear', 'Mildly weary'],
  4: ['Tired', 'Heavy eyed', 'Foggy', 'Sluggish', 'Flagging', 'Low energy'],
  5: ['Running low', 'Drained', 'Weary', 'Dragging', 'Half empty', 'Needing rest'],
  6: ['Worn down', 'Spent', 'Fried', 'Depleted', 'Checked out', 'Frayed'],
  7: ['Exhausted', 'Burnt out', 'Wrung out', 'On fumes', 'Hollow', 'Barely upright'],
  8: ['Barely coping', 'Shattered', 'Wiped out', 'Overloaded', "Can't focus", 'Unravelling'],
  9: ['Close to crashing', 'Collapsing', 'Done in', 'Nothing left', 'At my limit', 'Shutting down'],
  10: ['Full crash', 'Empty tank', 'Immobilized', 'Flatlined', 'Completely gone', 'Beyond exhausted'],
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(10, Math.round(score)));
}

export function moodWordsFor(score: number): string[] {
  return MOOD_WORDS[clampScore(score)] ?? [];
}

export function fatigueWordsFor(score: number): string[] {
  return FATIGUE_WORDS[clampScore(score)] ?? [];
}
