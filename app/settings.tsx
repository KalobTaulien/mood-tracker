import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Card } from '@/components/Card';
import { TimeField } from '@/components/TimeField';
import {
  getReminderTimes,
  getSetting,
  SETTING_KEYS,
  setReminderTimes,
  setSetting,
} from '@/db';
import {
  cancelLocalReminders,
  countLocalReminders,
  requestPermissions,
  scheduleLocalReminders,
  sendTestNotification,
} from '@/lib/notifications';
import {
  DEFAULT_REMINDER_TIMES,
  reminderTimesEqual,
  sortReminderTimes,
  type ReminderTime,
} from '@/lib/reminderTimes';
import { radius, spacing, usePalette } from '@/theme';

/** Row labels for the time pickers, in chronological order. */
const TIME_LABELS = ['First reminder', 'Second reminder', 'Third reminder'];

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const palette = usePalette();

  const [permission, setPermission] = useState<boolean | null>(null);
  const [localEnabled, setLocalEnabled] = useState(true);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [times, setTimes] = useState<ReminderTime[]>([...DEFAULT_REMINDER_TIMES]);
  const [testSent, setTestSent] = useState(false);

  const refresh = useCallback(async () => {
    const [count, enabledSetting, storedTimes] = await Promise.all([
      countLocalReminders(),
      getSetting(db, SETTING_KEYS.localRemindersEnabled),
      getReminderTimes(db),
    ]);
    setScheduledCount(count);
    setLocalEnabled(enabledSetting !== '0');
    setTimes(storedTimes);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onToggleLocal = useCallback(
    async (next: boolean) => {
      setLocalEnabled(next);
      await setSetting(db, SETTING_KEYS.localRemindersEnabled, next ? '1' : '0');
      if (next) {
        const granted = await requestPermissions();
        setPermission(granted);
        // Force a rebuild: switching back on should refill the queue right away.
        if (granted) await scheduleLocalReminders(times, { force: true });
      } else {
        await cancelLocalReminders();
      }
      await refresh();
    },
    [db, refresh, times]
  );

  /** Persists a new set of times and rebuilds the queue around them. */
  const applyTimes = useCallback(
    async (next: readonly ReminderTime[]) => {
      const ordered = sortReminderTimes(next);
      setTimes(ordered);
      await setReminderTimes(db, ordered);
      if (localEnabled) {
        const granted = await requestPermissions();
        setPermission(granted);
        // The queue is full of the old times, so this rebuild must be forced.
        if (granted) await scheduleLocalReminders(ordered, { force: true });
      }
      await refresh();
    },
    [db, localEnabled, refresh]
  );

  const onChangeTime = useCallback(
    (index: number, next: ReminderTime) =>
      applyTimes(times.map((time, i) => (i === index ? next : time))),
    [applyTimes, times]
  );

  const onTest = useCallback(async () => {
    const granted = await requestPermissions();
    setPermission(granted);
    if (!granted) return;
    await sendTestNotification();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 4000);
  }, []);

  const daysOfCoverage = Math.ceil(scheduledCount / Math.max(1, times.length));
  const isDefault = reminderTimesEqual(times, DEFAULT_REMINDER_TIMES);

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.content}>
      <Card
        title="On-device reminders"
        subtitle="Scheduled by the app itself. Works offline and needs no server or account."
        trailing={
          <Switch
            value={localEnabled}
            onValueChange={onToggleLocal}
            trackColor={{ true: palette.accent, false: palette.border }}
          />
        }>
        <View style={styles.timeList}>
          {times.map((time, index) => (
            <TimeField
              key={index}
              label={TIME_LABELS[index] ?? `Reminder ${index + 1}`}
              value={time}
              onChange={(next) => onChangeTime(index, next)}
            />
          ))}
        </View>

        {!isDefault && (
          <Pressable
            onPress={() => applyTimes(DEFAULT_REMINDER_TIMES)}
            hitSlop={6}
            style={styles.resetRow}>
            <Ionicons name="refresh" size={14} color={palette.accent} />
            <Text style={[styles.resetText, { color: palette.accent }]}>
              Reset to 9:00 AM, 2:00 PM, 8:00 PM
            </Text>
          </Pressable>
        )}

        <Text style={[styles.note, { color: palette.textFaint }]}>
          {scheduledCount > 0
            ? `${scheduledCount} reminders queued — about ${daysOfCoverage} days ahead. ` +
              'Opening the app extends the queue.'
            : 'No reminders scheduled right now.'}
        </Text>
      </Card>

      <Card title="Check it works" subtitle="Fires a local notification in three seconds.">
        <Pressable
          onPress={onTest}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: palette.cardAlt,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: palette.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <Text style={[styles.buttonText, { color: palette.text }]}>
            {testSent ? 'Sent — background the app to see it' : 'Send a test reminder'}
          </Text>
        </Pressable>
        <Row
          label="Permission"
          value={
            permission === null ? 'Unknown' : permission ? 'Granted' : 'Denied'
          }
          ok={permission === true}
        />
        <Row label="Platform" value={Platform.OS} ok />
      </Card>
    </ScrollView>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  const palette = usePalette();
  return (
    <View style={styles.row}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'ellipse-outline'}
        size={16}
        color={ok ? palette.success : palette.textFaint}
      />
      <Text style={[styles.rowLabel, { color: palette.textMuted }]}>{label}</Text>
      <Text
        style={[styles.rowValue, { color: palette.text }]}
        numberOfLines={1}
        ellipsizeMode="middle">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  timeList: { gap: spacing.sm },
  resetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  resetText: { fontSize: 13, fontWeight: '600' },
  note: { fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowLabel: { fontSize: 13.5, width: 94 },
  rowValue: { fontSize: 13.5, fontWeight: '600', flex: 1 },
  button: { borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
