import { StyleSheet, TextInput, View } from 'react-native';
import { radius, spacing, usePalette } from '../theme';

type Props = {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
  multiline?: boolean;
  minHeight?: number;
};

export function NotesField({
  value,
  onChange,
  placeholder,
  multiline = true,
  minHeight = 76,
}: Props) {
  const palette = usePalette();
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
          { color: palette.text, minHeight: multiline ? minHeight : undefined },
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
  input: { fontSize: 15, lineHeight: 21, paddingTop: 2, paddingBottom: 2 },
});
