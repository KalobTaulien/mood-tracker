import { StyleSheet, TextInput, View } from 'react-native';
import { radius, spacing, usePalette } from '../../theme';

type Props = {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
  /** 1 renders a single-line field; more sets a minimum height. */
  lines?: number;
};

const LINE_HEIGHT = 21;

export function NotesInput({ value, onChange, placeholder, lines = 3 }: Props) {
  const palette = usePalette();
  const multiline = lines > 1;

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: palette.cardAlt, borderColor: palette.border },
      ]}>
      <TextInput
        value={value ?? ''}
        onChangeText={(text) => onChange(text.length ? text : null)}
        placeholder={placeholder}
        placeholderTextColor={palette.textFaint}
        multiline={multiline}
        style={[
          styles.input,
          { color: palette.text, minHeight: multiline ? lines * LINE_HEIGHT + 12 : undefined },
        ]}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  input: { fontSize: 15, lineHeight: LINE_HEIGHT, paddingTop: 2, paddingBottom: 2 },
});
