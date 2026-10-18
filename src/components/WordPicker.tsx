import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import { Chip } from './Chip';
import { NotesField } from './NotesField';

type Props = {
  /** Words offered for the current score; empty hides the chip row. */
  suggestions: string[];
  word: string | null;
  onChangeWord: (word: string | null) => void;
  tint: string;
  /** Placeholder for the free-text field when no suggestions are shown. */
  emptyPlaceholder?: string;
};

/** Suggestion chips for the current score, plus a free-text escape hatch. */
export function WordPicker({
  suggestions,
  word,
  onChangeWord,
  tint,
  emptyPlaceholder = 'A word for how you feel',
}: Props) {
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
              selected={word?.toLowerCase() === suggestion.toLowerCase()}
              onPress={() =>
                onChangeWord(
                  word?.toLowerCase() === suggestion.toLowerCase() ? null : suggestion
                )
              }
            />
          ))}
        </View>
      )}
      <NotesField
        value={word}
        onChange={onChangeWord}
        placeholder={suggestions.length ? 'Or write your own word' : emptyPlaceholder}
        multiline={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
