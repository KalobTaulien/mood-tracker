import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
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
import { getSetting, SETTING_KEYS, setSetting } from '@/db';
import {
  cancelLocalReminders,
  countLocalReminders,
  fetchExpoPushToken,
  REMINDER_TIMES,
  registerTokenWithWorker,
  requestPermissions,
  scheduleLocalReminders,
  sendTestNotification,
} from '@/lib/notifications';
import { radius, spacing, usePalette } from '@/theme';

function formatTime(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const palette = usePalette();

  const [permission, setPermission] = useState<boolean | null>(null);
  const [localEnabled, setLocalEnabled] = useState(true);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [registerState, setRegisterState] = useState<'idle' | 'working' | 'ok' | 'failed'>(
    'idle'
  );
  const [testSent, setTestSent] = useState(false);

  const workerUrl = (Constants.expoConfig?.extra?.reminderWorkerUrl as string) || '';

  const refresh = useCallback(async () => {
    const [count, storedToken, enabledSetting] = await Promise.all([
      countLocalReminders(),
      getSetting(db, SETTING_KEYS.pushToken),
      getSetting(db, SETTING_KEYS.localRemindersEnabled),
    ]);
    setScheduledCount(count);
    setPushToken(storedToken);
    setLocalEnabled(enabledSetting !== '0');
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
        if (granted) await scheduleLocalReminders();
      } else {
        await cancelLocalReminders();
      }
      await refresh();
    },
    [db, refresh]
  );

  const onGetToken = useCallback(async () => {
    setRegisterState('working');
    const granted = await requestPermissions();
    setPermission(granted);
    if (!granted) {
      setRegisterState('failed');
      setPushError('Notification permission denied.');
      return;
    }
    const { token, error } = await fetchExpoPushToken();
    setPushToken(token);
    setPushError(error);
    if (!token) {
      setRegisterState('failed');
      return;
    }
    await setSetting(db, SETTING_KEYS.pushToken, token);
    if (!workerUrl) {
      setRegisterState('idle');
      return;
    }
    const ok = await registerTokenWithWorker(token);
    if (ok) await setSetting(db, SETTING_KEYS.pushTokenRegisteredAt, new Date().toISOString());
    setRegisterState(ok ? 'ok' : 'failed');
  }, [db, workerUrl]);

  const onTest = useCallback(async () => {
    const granted = await requestPermissions();
    setPermission(granted);
    if (!granted) return;
    await sendTestNotification();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 4000);
  }, []);

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={styles.content}>
      <Card
        title="On-device reminders"
        subtitle="Scheduled by the app itself. Works offline and needs no server."
        trailing={
          <Switch
            value={localEnabled}
            onValueChange={onToggleLocal}
            trackColor={{ true: palette.accent, false: palette.border }}
          />
        }>
        <View style={styles.timeRow}>
          {REMINDER_TIMES.map((time) => (
            <View
              key={`${time.hour}:${time.minute}`}
              style={[styles.timePill, { backgroundColor: palette.cardAlt }]}>
              <Ionicons name="time-outline" size={14} color={palette.textMuted} />
              <Text style={[styles.timeText, { color: palette.text }]}>
                {formatTime(time.hour, time.minute)}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[styles.note, { color: palette.textFaint }]}>
          {scheduledCount > 0
            ? `${scheduledCount} daily reminder${scheduledCount === 1 ? '' : 's'} currently scheduled.`
            : 'No reminders scheduled right now.'}
        </Text>
      </Card>

      <Card
        title="Cloudflare push reminders"
        subtitle="A Worker cron trigger fires the same three reminders through Expo's push service.">
        <Row
          label="Worker URL"
          value={workerUrl || 'Not configured'}
          ok={!!workerUrl}
        />
        <Row
          label="Push token"
          value={pushToken ? `${pushToken.slice(0, 26)}…` : 'Not obtained'}
          ok={!!pushToken}
        />
        {!!pushError && (
          <Text style={[styles.error, { color: palette.danger }]}>{pushError}</Text>
        )}
        <Pressable
          onPress={onGetToken}
          disabled={registerState === 'working'}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: palette.accent, opacity: pressed ? 0.85 : 1 },
          ]}>
          <Text style={styles.buttonText}>
            {registerState === 'working'
              ? 'Working…'
              : registerState === 'ok'
                ? 'Registered with Worker ✓'
                : 'Get token & register'}
          </Text>
        </Pressable>
        {registerState === 'failed' && (
          <Text style={[styles.error, { color: palette.danger }]}>
            Could not register. Check the Worker URL and secret in app.json.
          </Text>
        )}
        <Text style={[styles.note, { color: palette.textFaint }]}>
          Remote push needs a development or TestFlight build — it does not work in Expo
          Go on iOS.
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
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  timeText: { fontSize: 13.5, fontWeight: '600' },
  note: { fontSize: 12, lineHeight: 17 },
  error: { fontSize: 12.5, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowLabel: { fontSize: 13.5, width: 94 },
  rowValue: { fontSize: 13.5, fontWeight: '600', flex: 1 },
  button: { borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
