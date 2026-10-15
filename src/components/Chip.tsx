import { Pressable, StyleSheet, Text } from 'react-native';
import { radius, spacing, usePalette } from '../theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  tint?: string;
  size?: 'sm' | 'md';
};

export function Chip({ label, selected = false, onPress, tint, size = 'md' }: Props) {
  const palette = usePalette();
  const activeTint = tint ?? palette.accent;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        size === 'sm' ? styles.chipSm : styles.chipMd,
        {
          backgroundColor: selected ? activeTint : palette.cardAlt,
          borderColor: selected ? activeTint : palette.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      <Text
        style={[
          size === 'sm' ? styles.textSm : styles.textMd,
          { color: selected ? '#FFFFFF' : palette.textMuted },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipMd: { paddingHorizontal: spacing.lg, paddingVertical: 9 },
  chipSm: { paddingHorizontal: spacing.md, paddingVertical: 6 },
  textMd: { fontSize: 14, fontWeight: '600' },
  textSm: { fontSize: 13, fontWeight: '600' },
});
