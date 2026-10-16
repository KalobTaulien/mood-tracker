import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatReminderTime, type ReminderTime } from '../lib/reminderTimes';
import { radius, spacing, useIsDark, usePalette } from '../theme';

type Props = {
  value: ReminderTime;
  onChange: (next: ReminderTime) => void;
  /** Shown beside the time, e.g. "First reminder". */
  label: string;
};

function toDate({ hour, minute }: ReminderTime): Date {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function toReminderTime(date: Date): ReminderTime {
  return { hour: date.getHours(), minute: date.getMinutes() };
}

/** A single tappable row that edits one time of day. */
export function TimeField({ value, onChange, label }: Props) {
  const palette = usePalette();
  const isDark = useIsDark();
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => toDate(value));

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(value),
        mode: 'time',
        // onValueChange fires only on a real selection, so a dismissal needs
        // no filtering — it just never calls back.
        onValueChange: (_event, picked) => onChange(toReminderTime(picked)),
      });
    } else {
      // Re-seed from the current value so a cancelled edit leaves no residue.
      setDraft(toDate(value));
      setIosPickerOpen(true);
    }
  };

  return (
    <>
      <Pressable
        onPress={openPicker}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: palette.cardAlt,
            borderColor: palette.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}>
        <Ionicons name="time-outline" size={17} color={palette.textMuted} />
        <Text style={[styles.label, { color: palette.textMuted }]}>{label}</Text>
        <Text style={[styles.value, { color: palette.text }]}>
          {formatReminderTime(value)}
        </Text>
        <Ionicons name="chevron-forward" size={15} color={palette.textFaint} />
      </Pressable>

      {Platform.OS === 'ios' && (
        <Modal
          visible={iosPickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIosPickerOpen(false)}>
          <Pressable
            style={[styles.backdrop, { backgroundColor: palette.overlay }]}
            onPress={() => setIosPickerOpen(false)}
          />
          <View
            style={[
              styles.sheet,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setIosPickerOpen(false)} hitSlop={8}>
                <Text style={[styles.sheetAction, { color: palette.textMuted }]}>
                  Cancel
                </Text>
              </Pressable>
              <Text style={[styles.sheetTitle, { color: palette.text }]}>{label}</Text>
              <Pressable
                onPress={() => {
                  onChange(toReminderTime(draft));
                  setIosPickerOpen(false);
                }}
                hitSlop={8}>
                <Text style={[styles.sheetAction, { color: palette.accent }]}>Set</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={draft}
              mode="time"
              display="spinner"
              themeVariant={isDark ? 'dark' : 'light'}
              onValueChange={(_event, picked) => setDraft(picked)}
            />
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  label: { fontSize: 14, flex: 1 },
  value: { fontSize: 15, fontWeight: '600' },
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  sheetTitle: { fontSize: 16, fontWeight: '600' },
  sheetAction: { fontSize: 16, fontWeight: '600' },
});
