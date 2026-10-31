import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { radius, spacing, usePalette } from '../../theme';

type Props = {
  words: string[];
  onChange: (words: string[]) => void;
};

/** Editable list of suggestion words for a word-choice field. */
export function WordListEditor({ words, onChange }: Props) {
  const palette = usePalette();
  const [draft, setDraft] = useState('');

  const add = () => {
    const word = draft.trim();
    if (!word) return;
    if (words.some((existing) => existing.toLowerCase() === word.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...words, word]);
    setDraft('');
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: palette.text }]}>Words to choose from</Text>
      <Text style={[styles.hint, { color: palette.textMuted }]}>
        {words.length === 0
          ? 'None yet. Add a few and they appear as tappable chips.'
          : `${words.length} ${words.length === 1 ? 'word' : 'words'}. Tap one to remove it.`}
      </Text>

      {words.length > 0 && (
        <View style={styles.chips}>
          {words.map((word) => (
            <Pressable
              key={word}
              onPress={() => onChange(words.filter((item) => item !== word))}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: palette.cardAlt,
                  borderColor: palette.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <Text style={[styles.chipText, { color: palette.text }]}>{word}</Text>
              <Ionicons name="close" size={13} color={palette.textFaint} />
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.addRow}>
        <View
          style={[
            styles.inputWrap,
            { backgroundColor: palette.cardAlt, borderColor: palette.border },
          ]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            placeholder="Add a word"
            placeholderTextColor={palette.textFaint}
            returnKeyType="done"
            autoCapitalize="none"
            style={[styles.input, { color: palette.text }]}
          />
        </View>
        <Pressable
          onPress={add}
          disabled={!draft.trim()}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: draft.trim() ? palette.accent : palette.cardAlt,
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <Ionicons
            name="add"
            size={20}
            color={draft.trim() ? '#FFFFFF' : palette.textFaint}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontSize: 14.5, fontWeight: '600' },
  hint: { fontSize: 12.5, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  inputWrap: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  input: { fontSize: 15, paddingVertical: spacing.sm + 2 },
  addButton: {
    width: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
