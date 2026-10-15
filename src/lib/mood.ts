/** Suggested words per mood score. Free text is always allowed instead. */
export const MOOD_WORDS: Record<number, string[]> = {
  0: ['Numb', 'Empty', 'Hopeless'],
  1: ['Crushed', 'Despairing', 'Bleak'],
  2: ['Awful', 'Sinking', 'Raw'],
  3: ['Low', 'Heavy', 'Discouraged'],
  4: ['Flat', 'Drained', 'Meh'],
  5: ['Neutral', 'Okay', 'Even'],
  6: ['Steady', 'Fine', 'Settled'],
  7: ['Good', 'Lifted', 'Content'],
  8: ['Happy', 'Bright', 'Warm'],
  9: ['Great', 'Energized', 'Glad'],
  10: ['Elated', 'Radiant', 'Alive'],
};

export const FATIGUE_LABELS: Record<number, string> = {
  0: 'Fully rested',
  1: 'Fresh',
  2: 'Mostly fine',
  3: 'Slightly tired',
  4: 'Tired',
  5: 'Running low',
  6: 'Worn down',
  7: 'Heavily depleted',
  8: 'Barely coping',
  9: 'Close to crashing',
  10: 'Full crash',
};

export function moodWordsFor(score: number): string[] {
  return MOOD_WORDS[Math.max(0, Math.min(10, Math.round(score)))] ?? [];
}

export function fatigueLabelFor(score: number): string {
  return FATIGUE_LABELS[Math.max(0, Math.min(10, Math.round(score)))] ?? '';
}
