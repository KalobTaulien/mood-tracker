import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Local times the reminder fires each day. */
export const REMINDER_TIMES = [
  { hour: 9, minute: 0 },
  { hour: 14, minute: 0 },
  { hour: 20, minute: 0 },
] as const;

export const REMINDER_TITLE = 'Track your mood';

/**
 * Body copy per time slot, indexed to match REMINDER_TIMES. Each occurrence
 * picks a line by calendar date, so consecutive days read differently instead
 * of repeating one sentence sixty times.
 */
const REMINDER_BODIES: readonly (readonly string[])[] = [
  [
    'A quick check-in — it only takes a moment.',
    'How are you starting the day?',
    'Morning. Where is your head at?',
    'Take a second to note how you feel.',
    'A fresh day — how does it feel so far?',
  ],
  [
    "How's the afternoon treating you?",
    'Midday check-in — how are you doing?',
    'Pause for a moment. How do you feel?',
    'Halfway through. How is today going?',
    'A quick afternoon note on your mood?',
  ],
  [
    'How did today land?',
    'Winding down — how was today?',
    'Before the day ends, how do you feel?',
    'Any thoughts on how today went?',
    'One last check-in for today.',
  ],
];

/**
 * iOS keeps at most 64 pending notifications per app and silently drops the
 * rest, so stop short of that and leave room for the test reminder. At three a
 * day this covers twenty days; the queue is topped up on every app launch.
 */
export const MAX_SCHEDULED_REMINDERS = 60;

const LOCAL_REMINDER_IDENTIFIER_PREFIX = 'mood-reminder-';
const ANDROID_CHANNEL_ID = 'mood-reminders';

export type NotificationSetupResult = {
  permissionGranted: boolean;
  localRemindersScheduled: number;
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

type Occurrence = { date: Date; slot: number };

/**
 * Whole days since the epoch in local time. Used to seed the copy rotation so a
 * given calendar date always gets the same line, even though the queue is
 * rebuilt from scratch on each launch.
 */
function localDayIndex(date: Date): number {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / 86_400_000);
}

/** The next `count` reminder slots strictly after `from`, in chronological order. */
function upcomingOccurrences(count: number, from: Date): Occurrence[] {
  const occurrences: Occurrence[] = [];

  for (let dayOffset = 0; occurrences.length < count; dayOffset += 1) {
    for (const [slot, time] of REMINDER_TIMES.entries()) {
      if (occurrences.length >= count) break;

      const date = new Date(from);
      date.setDate(date.getDate() + dayOffset);
      date.setHours(time.hour, time.minute, 0, 0);
      // Slots already past today are skipped rather than scheduled in the past.
      if (date.getTime() <= from.getTime()) continue;

      occurrences.push({ date, slot });
    }
  }

  return occurrences;
}

function bodyFor({ date, slot }: Occurrence): string {
  const options = REMINDER_BODIES[slot];
  return options[localDayIndex(date) % options.length];
}

/**
 * Fills the pending queue with the next MAX_SCHEDULED_REMINDERS reminders.
 *
 * The queue only shrinks as reminders fire, so a full one is already correct and
 * is left alone unless `force` is set. Any rebuild cancels first, so repeated
 * calls cannot stack duplicate triggers.
 */
export async function scheduleLocalReminders(
  options: { force?: boolean } = {}
): Promise<number> {
  const { force = false } = options;
  await ensureAndroidChannel();

  if (!force && (await countLocalReminders()) >= MAX_SCHEDULED_REMINDERS) {
    return MAX_SCHEDULED_REMINDERS;
  }

  await cancelLocalReminders();

  const occurrences = upcomingOccurrences(MAX_SCHEDULED_REMINDERS, new Date());
  await Promise.all(
    occurrences.map((occurrence, index) =>
      Notifications.scheduleNotificationAsync({
        identifier: `${LOCAL_REMINDER_IDENTIFIER_PREFIX}${index}`,
        content: {
          title: REMINDER_TITLE,
          body: bodyFor(occurrence),
          data: { url: '/' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: occurrence.date,
          // channelId belongs on the trigger; the content input ignores it.
          ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
        },
      })
    )
  );

  return occurrences.length;
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
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });
}

/** One-shot setup on app start: permissions, then top up the reminder queue. */
export async function setUpNotifications(
  options: { enableLocalReminders?: boolean } = {}
): Promise<NotificationSetupResult> {
  const { enableLocalReminders = true } = options;

  const permissionGranted = await requestPermissions();
  if (!permissionGranted) {
    return { permissionGranted: false, localRemindersScheduled: 0 };
  }

  if (!enableLocalReminders) {
    await cancelLocalReminders();
    return { permissionGranted: true, localRemindersScheduled: 0 };
  }

  return {
    permissionGranted: true,
    localRemindersScheduled: await scheduleLocalReminders(),
  };
}
