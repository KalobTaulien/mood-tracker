import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { radius, spacing, usePalette } from '../../theme';

/** The labelled rows the field editor is built from. */

export function TextSetting({
  label,
  hint,
  value,
  onChange,
  placeholder,
  multiline = false,
  optional = false,
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  multiline?: boolean;
  optional?: boolean;
}) {
  const palette = usePalette();
  return (
    <View style={styles.block}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
        {optional && (
          <Text style={[styles.optional, { color: palette.textFaint }]}>optional</Text>
        )}
      </View>
      {!!hint && <Text style={[styles.hint, { color: palette.textMuted }]}>{hint}</Text>}
      <View
        style={[
          styles.inputWrap,
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
            { color: palette.text, minHeight: multiline ? 64 : undefined },
          ]}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      </View>
    </View>
  );
}

export function ToggleSetting({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const palette = usePalette();
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
        {!!hint && <Text style={[styles.hint, { color: palette.textMuted }]}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: palette.accent, false: palette.border }}
      />
    </View>
  );
}

export function NumberSetting({
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}) {
  const palette = usePalette();
  const step = (delta: number) => onChange(Math.max(min, Math.min(max, value + delta)));

  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
        {!!hint && <Text style={[styles.hint, { color: palette.textMuted }]}>{hint}</Text>}
      </View>
      <View style={[styles.stepper, { backgroundColor: palette.cardAlt, borderColor: palette.border }]}>
        <Pressable
          onPress={() => step(-1)}
          disabled={value <= min}
          hitSlop={6}
          style={styles.stepperButton}>
          <Ionicons
            name="remove"
            size={18}
            color={value <= min ? palette.textFaint : palette.accent}
          />
        </Pressable>
        <Text style={[styles.stepperValue, { color: palette.text }]}>{value}</Text>
        <Pressable
          onPress={() => step(1)}
          disabled={value >= max}
          hitSlop={6}
          style={styles.stepperButton}>
          <Ionicons
            name="add"
            size={18}
            color={value >= max ? palette.textFaint : palette.accent}
          />
        </Pressable>
      </View>
    </View>
  );
}

export function SegmentedSetting<T extends string | number>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const palette = usePalette();
  return (
    <View style={styles.block}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      {!!hint && <Text style={[styles.hint, { color: palette.textMuted }]}>{hint}</Text>}
      <View
        style={[
          styles.segments,
          { backgroundColor: palette.cardAlt, borderColor: palette.border },
        ]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => onChange(option.value)}
              style={[
                styles.segment,
                selected && { backgroundColor: palette.card },
              ]}>
              <Text
                style={[
                  styles.segmentLabel,
                  { color: selected ? palette.text : palette.textMuted },
                ]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  label: { fontSize: 14.5, fontWeight: '600' },
  optional: { fontSize: 12 },
  hint: { fontSize: 12.5, lineHeight: 17 },
  inputWrap: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: 2,
  },
  input: { fontSize: 15, lineHeight: 21, paddingTop: 2, paddingBottom: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toggleText: { flex: 1, gap: 1 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stepperButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  stepperValue: { fontSize: 15, fontWeight: '700', minWidth: 34, textAlign: 'center' },
  segments: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 2,
    marginTop: 2,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  segmentLabel: { fontSize: 13.5, fontWeight: '600' },
});
