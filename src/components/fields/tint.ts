import { sliderGoodness, type EntryValues, type FormField } from '../../forms';
import { scoreColor, type Palette } from '../../theme';

/**
 * The accent colour a field's control should use right now.
 *
 * Sliders colour themselves by how well the answer reads — `goodEnd` means a
 * low-is-good scale like fatigue tints the same way a high-is-good one does.
 * A word field tied to a slider borrows that slider's colour so the pair reads
 * as one thing. Everything else uses the app accent.
 */
export function fieldTint(
  field: FormField,
  values: EntryValues,
  fields: readonly FormField[],
  palette: Palette,
  isDark: boolean
): string {
  if (field.kind === 'slider') {
    const value = values[field.id];
    if (typeof value !== 'number') return palette.accent;
    return scoreColor(sliderGoodness(field, value) * 10, isDark);
  }

  if (field.kind === 'words' && field.linkedSliderId) {
    const slider = fields.find(
      (candidate): candidate is Extract<FormField, { kind: 'slider' }> =>
        candidate.id === field.linkedSliderId && candidate.kind === 'slider'
    );
    if (slider) return fieldTint(slider, values, fields, palette, isDark);
  }

  return palette.accent;
}
