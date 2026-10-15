import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, usePalette } from '../theme';

export const RANGES = [7, 14, 30, 60] as const;
export type Range = (typeof RANGES)[number];

type Props = {
  value: Range;
  onChange: (range: Range) => void;
};

export function RangeSelector({ value, onChange }: Props) {
  const palette = usePalette();
  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: palette.cardAlt, borderColor: palette.border },
      ]}>
      {RANGES.map((range) => {
        const selected = range === value;
        return (
          <Pressable
            key={range}
            onPress={() => onChange(range)}
            style={[
              styles.segment,
              selected && { backgroundColor: palette.card },
              selected && styles.segmentSelected,
            ]}>
            <Text
              style={[
                styles.label,
                { color: selected ? palette.text : palette.textMuted },
              ]}>
              {range}d
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  segmentSelected: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  label: { fontSize: 14, fontWeight: '600' },
});
