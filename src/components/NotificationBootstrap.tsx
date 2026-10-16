import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { getSetting, SETTING_KEYS } from '../db/settings';
import { setUpNotifications } from '../lib/notifications';

/**
 * Runs notification setup once per app launch, inside the SQLite provider so the
 * enabled setting can be read. This is also what tops up the reminder queue, so
 * the twenty-day runway keeps extending as long as the app gets opened. Renders
 * nothing; failures are intentionally silent because the Reminders screen
 * surfaces the real state on demand.
 */
export function NotificationBootstrap() {
  const db = useSQLiteContext();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        const enabled = await getSetting(db, SETTING_KEYS.localRemindersEnabled);
        await setUpNotifications({ enableLocalReminders: enabled !== '0' });
      } catch {
        // Non-fatal: the app is fully usable without notifications.
      }
    })();
  }, [db]);

  return null;
}
