import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, usePalette } from '@/theme';

export default function NotFoundScreen() {
  const palette = usePalette();
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={[styles.container, { backgroundColor: palette.bg }]}>
        <Text style={[styles.title, { color: palette.text }]}>
          That screen does not exist.
        </Text>
        <Link href="/" style={StyleSheet.flatten([styles.link, { color: palette.accent }])}>
          Go to the log screen
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  title: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  link: { fontSize: 15, fontWeight: '600' },
});
