import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateTime, relativeFromNow } from '../lib/dates';
import { radius, spacing, useIsDark, usePalette } from '../theme';
import { Chip } from './Chip';

type Props = {
  value: string | null;
  onChange: (iso: string | null) => void;
  /** Shown on the "pick a moment" button when nothing is set. */
  emptyLabel?: string;
};

function hoursAgo(hours: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export function DateTimeField({ value, onChange, emptyLabel = 'Pick a date & time' }: Props) {
  const palette = usePalette();
  const isDark = useIsDark();
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>(new Date());

  const openPicker = () => {
    const initial = value ? new Date(value) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        maximumDate: new Date(),
        // onValueChange fires only on a real selection, so dismissing either
        // dialog just stops the flow — no event-type guard needed.
        onValueChange: (_dateEvent, pickedDate) => {
          DateTimePickerAndroid.open({
            value: pickedDate,
            mode: 'time',
            onValueChange: (_timeEvent, pickedTime) => {
              const merged = new Date(pickedDate);
              merged.setHours(pickedTime.getHours(), pickedTime.getMinutes(), 0, 0);
              onChange(merged.toISOString());
            },
          });
        },
      });
    } else {
      setDraftDate(initial);
      setIosPickerOpen(true);
    }
  };

  return (
    <View style={styles.wrap}>
      {value ? (
        <View
          style={[
            styles.valueRow,
            { backgroundColor: palette.accentSoft, borderColor: palette.border },
          ]}>
          <View style={styles.valueText}>
            <Text style={[styles.value, { color: palette.text }]}>
              {formatDateTime(value)}
            </Text>
            <Text style={[styles.relative, { color: palette.textMuted }]}>
              {relativeFromNow(value)}
            </Text>
          </View>
          <Pressable onPress={openPicker} hitSlop={6} style={styles.action}>
            <Text style={[styles.actionText, { color: palette.accent }]}>Change</Text>
          </Pressable>
          <Pressable onPress={() => onChange(null)} hitSlop={6} style={styles.action}>
            <Text style={[styles.actionText, { color: palette.textMuted }]}>Clear</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={openPicker}
          style={({ pressed }) => [
            styles.empty,
            {
              backgroundColor: palette.cardAlt,
              borderColor: palette.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          <Text style={[styles.emptyText, { color: palette.textMuted }]}>{emptyLabel}</Text>
        </Pressable>
      )}

      <View style={styles.quickRow}>
        <Chip
          size="sm"
          label="Just now"
          onPress={() => onChange(new Date().toISOString())}
        />
        <Chip
          size="sm"
          label="A few hours ago"
          onPress={() => onChange(hoursAgo(4).toISOString())}
        />
        <Chip size="sm" label="Yesterday" onPress={() => onChange(daysAgo(1).toISOString())} />
        <Chip size="sm" label="A week ago" onPress={() => onChange(daysAgo(7).toISOString())} />
      </View>

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
                <Text style={[styles.sheetAction, { color: palette.textMuted }]}>Cancel</Text>
              </Pressable>
              <Text style={[styles.sheetTitle, { color: palette.text }]}>When?</Text>
              <Pressable
                onPress={() => {
                  onChange(draftDate.toISOString());
                  setIosPickerOpen(false);
                }}
                hitSlop={8}>
                <Text style={[styles.sheetAction, { color: palette.accent }]}>Set</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={draftDate}
              mode="datetime"
              display="spinner"
              maximumDate={new Date()}
              themeVariant={isDark ? 'dark' : 'light'}
              onValueChange={(_event, picked) => setDraftDate(picked)}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  valueText: { flex: 1, gap: 1 },
  value: { fontSize: 15, fontWeight: '600' },
  relative: { fontSize: 12.5 },
  action: { paddingHorizontal: 2 },
  actionText: { fontSize: 13.5, fontWeight: '600' },
  empty: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  emptyText: { fontSize: 15 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
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
