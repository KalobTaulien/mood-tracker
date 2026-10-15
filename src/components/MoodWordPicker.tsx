import { StyleSheet, View } from 'react-native';
import { moodWordsFor } from '../lib/mood';
import { spacing } from '../theme';
import { Chip } from './Chip';
import { NotesField } from './NotesField';

type Props = {
  score: number | null;
  word: string | null;
  onChangeWord: (word: string | null) => void;
  tint: string;
};

/** Suggestion chips for the current score, plus a free-text escape hatch. */
export function MoodWordPicker({ score, word, onChangeWord, tint }: Props) {
  const suggestions = score === null ? [] : moodWordsFor(score);

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
        placeholder={
          suggestions.length ? 'Or write your own word' : 'A word for how you feel'
        }
        multiline={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
