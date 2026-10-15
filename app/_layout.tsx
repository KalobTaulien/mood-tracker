import { SQLiteProvider } from 'expo-sqlite';
import { Stack, router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NotificationBootstrap } from '@/components/NotificationBootstrap';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/db';
import { configureNotificationHandler } from '@/lib/notifications';
import { useIsDark, usePalette } from '@/theme';

configureNotificationHandler();

/** Routes notification taps to the screen named in the payload's `url`. */
function useNotificationRouting() {
  useEffect(() => {
    async function redirect(notification: Notifications.Notification) {
      const url = notification.request.content.data?.url;
      if (typeof url === 'string') {
        router.navigate(url as never);
        // Clear it so a cold start does not re-navigate on the next launch.
        await Notifications.clearLastNotificationResponseAsync();
      }
    }

    // Handles the app being launched by tapping a notification.
    Notifications.getLastNotificationResponseAsync().then((last) => {
      if (last?.notification) redirect(last.notification);
    });

    // Handles taps while the app is already running.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
      redirect(response.notification)
    );
    return () => subscription.remove();
  }, []);
}

function Loading() {
  const palette = usePalette();
  return (
    <View style={[styles.loading, { backgroundColor: palette.bg }]}>
      <ActivityIndicator color={palette.accent} />
      <Text style={[styles.loadingText, { color: palette.textMuted }]}>
        Opening your journal…
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const palette = usePalette();
  const isDark = useIsDark();
  useNotificationRouting();

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Suspense fallback={<Loading />}>
          <SQLiteProvider
            databaseName={DATABASE_NAME}
            onInit={migrateDbIfNeeded}
            useSuspense>
            <NotificationBootstrap />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: palette.bg },
                headerTitleStyle: { color: palette.text, fontWeight: '600' },
                headerTintColor: palette.accent,
                headerShadowVisible: false,
                contentStyle: { backgroundColor: palette.bg },
              }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="log/[id]"
                options={{ title: 'Log details', presentation: 'card' }}
              />
              <Stack.Screen
                name="settings"
                options={{ title: 'Reminders', presentation: 'modal' }}
              />
            </Stack>
          </SQLiteProvider>
        </Suspense>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
});
