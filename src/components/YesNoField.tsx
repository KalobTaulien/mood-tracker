import { StyleSheet, View } from 'react-native';
import { spacing, usePalette } from '../theme';
import { Chip } from './Chip';

type Props = {
  value: number | null;
  onChange: (value: number | null) => void;
};

/** Tapping the selected option clears it, since the field is optional. */
export function YesNoField({ value, onChange }: Props) {
  const palette = usePalette();
  return (
    <View style={styles.row}>
      <Chip
        label="Yes"
        selected={value === 1}
        tint={palette.success}
        onPress={() => onChange(value === 1 ? null : 1)}
      />
      <Chip
        label="No"
        selected={value === 0}
        tint={palette.textMuted}
        onPress={() => onChange(value === 0 ? null : 0)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
});
