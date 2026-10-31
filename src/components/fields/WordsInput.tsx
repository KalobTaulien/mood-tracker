import { StyleSheet, Text, View } from 'react-native';
import type { WordsField } from '../../forms';
import { spacing, usePalette } from '../../theme';
import { Chip } from '../Chip';
import { NotesInput } from './NotesInput';

type Props = {
  field: WordsField;
  /** Already resolved for the current entry — may follow a linked slider. */
  suggestions: string[];
  value: string | null;
  onChange: (value: string | null) => void;
  tint: string;
};

/** Suggestion chips, plus a free-text escape hatch when the field allows one. */
export function WordsInput({ field, suggestions, value, onChange, tint }: Props) {
  const palette = usePalette();
  const selected = value?.trim().toLowerCase() ?? null;

  return (
    <View style={styles.wrap}>
      {suggestions.length > 0 && (
        <View style={styles.chips}>
          {suggestions.map((suggestion) => (
            <Chip
              key={suggestion}
              size="sm"
              label={suggestion}
              tint={tint}
              selected={selected === suggestion.toLowerCase()}
              onPress={() =>
                onChange(selected === suggestion.toLowerCase() ? null : suggestion)
              }
            />
          ))}
        </View>
      )}

      {field.allowCustom ? (
        <NotesInput
          value={value}
          onChange={onChange}
          placeholder={suggestions.length ? 'Or write your own word' : 'A word for how you feel'}
          lines={1}
        />
      ) : (
        suggestions.length === 0 && (
          <Text style={[styles.empty, { color: palette.textFaint }]}>
            This field has no words to choose from yet. Add some in Settings › Your form.
          </Text>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  empty: { fontSize: 13, lineHeight: 18 },
});
