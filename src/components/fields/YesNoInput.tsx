import { StyleSheet, View } from 'react-native';
import type { YesNoField } from '../../forms';
import { spacing, usePalette } from '../../theme';
import { Chip } from '../Chip';

type Props = {
  field: YesNoField;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
};

/** Tapping the selected option clears it, since every field is optional. */
export function YesNoInput({ field, value, onChange }: Props) {
  const palette = usePalette();
  return (
    <View style={styles.row}>
      <Chip
        label={field.yesLabel}
        selected={value === true}
        tint={palette.success}
        onPress={() => onChange(value === true ? null : true)}
      />
      <Chip
        label={field.noLabel}
        selected={value === false}
        tint={palette.textMuted}
        onPress={() => onChange(value === false ? null : false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
});
