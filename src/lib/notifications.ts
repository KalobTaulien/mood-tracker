import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { nowIso } from './dates';
import { getSetting, SETTING_KEYS, setSetting } from '../db/settings';

/** Local times the reminder fires. Mirrors the Cloudflare cron schedule. */
export const REMINDER_TIMES = [
  { hour: 9, minute: 0 },
  { hour: 14, minute: 0 },
  { hour: 20, minute: 0 },
] as const;

export const REMINDER_TITLE = 'Track your mood';
export const REMINDER_BODY = 'A quick check-in — it only takes a moment.';
const LOCAL_REMINDER_IDENTIFIER_PREFIX = 'mood-reminder-';
const ANDROID_CHANNEL_ID = 'mood-reminders';

export type NotificationSetupResult = {
  permissionGranted: boolean;
  expoPushToken: string | null;
  localRemindersScheduled: number;
  /** Why a push token could not be obtained, when applicable. */
  pushTokenError: string | null;
};

/** Foreground presentation: still show the banner so a reminder is never missed. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Mood reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#5B6CFF',
  });
}

export async function requestPermissions(): Promise<boolean> {
  await ensureAndroidChannel();
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function resolveProjectId(): string | null {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId ??
    null
  );
}

/**
 * Expo push token for the Cloudflare Worker to target.
 * Needs an EAS project id (`eas init`) and a dev/TestFlight build — not Expo Go on iOS.
 */
export async function fetchExpoPushToken(): Promise<{
  token: string | null;
  error: string | null;
}> {
  if (!Device.isDevice && Platform.OS === 'android') {
    return { token: null, error: 'Android emulators cannot receive remote push.' };
  }
  const projectId = resolveProjectId();
  if (!projectId) {
    return {
      token: null,
      error: 'No EAS project id yet — run `npx eas init` to enable remote push.',
    };
  }
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: data, error: null };
  } catch (error) {
    return { token: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Posts the token to the Worker so its cron job knows where to send reminders. */
export async function registerTokenWithWorker(token: string): Promise<boolean> {
  const workerUrl = Constants.expoConfig?.extra?.reminderWorkerUrl as string | undefined;
  const secret = Constants.expoConfig?.extra?.reminderWorkerSecret as string | undefined;
  if (!workerUrl) return false;

  try {
    const response = await fetch(`${workerUrl.replace(/\/$/, '')}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Three daily local notifications as an always-works fallback.
 * Cleared and rescheduled each time so duplicate triggers never pile up.
 */
export async function scheduleLocalReminders(): Promise<number> {
  await ensureAndroidChannel();
  await cancelLocalReminders();

  let scheduled = 0;
  for (const [index, time] of REMINDER_TIMES.entries()) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${LOCAL_REMINDER_IDENTIFIER_PREFIX}${index}`,
      content: {
        title: REMINDER_TITLE,
        body: REMINDER_BODY,
        data: { url: '/' },
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: time.hour,
        minute: time.minute,
      },
    });
    scheduled += 1;
  }
  return scheduled;
}

export async function cancelLocalReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.identifier.startsWith(LOCAL_REMINDER_IDENTIFIER_PREFIX))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
  );
}

export async function countLocalReminders(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.filter((item) =>
    item.identifier.startsWith(LOCAL_REMINDER_IDENTIFIER_PREFIX)
  ).length;
}

/** Fires an immediate notification so the wiring can be checked on a simulator. */
export async function sendTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: REMINDER_TITLE,
      body: 'Test reminder — tapping this opens the log screen.',
      data: { url: '/' },
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
    },
  });
}

/**
 * One-shot setup on app start: permissions, local fallback schedule,
 * then a best-effort remote push token registration.
 */
export async function setUpNotifications(
  db: SQLiteDatabase,
  options: { enableLocalReminders?: boolean } = {}
): Promise<NotificationSetupResult> {
  const { enableLocalReminders = true } = options;

  const permissionGranted = await requestPermissions();
  if (!permissionGranted) {
    return {
      permissionGranted: false,
      expoPushToken: null,
      localRemindersScheduled: 0,
      pushTokenError: 'Notification permission denied.',
    };
  }

  let localRemindersScheduled = 0;
  if (enableLocalReminders) {
    localRemindersScheduled = await scheduleLocalReminders();
  } else {
    await cancelLocalReminders();
  }

  const { token, error } = await fetchExpoPushToken();
  if (token) {
    const stored = await getSetting(db, SETTING_KEYS.pushToken);
    const registeredAt = await getSetting(db, SETTING_KEYS.pushTokenRegisteredAt);
    // Re-register when the token changed, or once a week to survive KV expiry.
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const stale =
      !registeredAt || Date.now() - new Date(registeredAt).getTime() > weekMs;

    if (stored !== token || stale) {
      const ok = await registerTokenWithWorker(token);
      await setSetting(db, SETTING_KEYS.pushToken, token);
      if (ok) await setSetting(db, SETTING_KEYS.pushTokenRegisteredAt, nowIso());
    }
  }

  return {
    permissionGranted: true,
    expoPushToken: token,
    localRemindersScheduled,
    pushTokenError: error,
  };
}
