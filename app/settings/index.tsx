import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { useForm } from '@/hooks/useForm';
import { countEntries } from '@/store';
import { radius, spacing, usePalette } from '@/theme';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { visibleFields } = useForm();
  const [entries, setEntries] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      countEntries(db).then(setEntries);
    }, [db])
  );

  const fieldCount = visibleFields.length;

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xl },
      ]}>
      <Card title="Your check-in">
        <Row
          href="/form"
          icon="construct-outline"
          label="Your form"
          value={`${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'}`}
          hint="Add, reorder, rename, or remove the questions you answer."
        />
      </Card>

      <Card title="Reminders">
        <Row
          href="/settings/reminders"
          icon="notifications-outline"
          label="Reminder times"
          hint="Three on-device nudges a day. No server, no account."
        />
      </Card>

      <Card title="Your data">
        <Row
          href="/settings/privacy"
          icon="lock-closed-outline"
          label="Privacy & data"
          value={entries === null ? undefined : `${entries} ${entries === 1 ? 'entry' : 'entries'}`}
          hint="Where your journal lives, how to back it up, and how to erase it."
        />
      </Card>

      <Text style={[styles.footnote, { color: palette.textFaint }]}>
        Everything you write stays on this device. The app has no account, no sync, and
        makes no network requests with your journal.
      </Text>
    </ScrollView>
  );
}

function Row({
  href,
  icon,
  label,
  value,
  hint,
}: {
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  hint: string;
}) {
  const palette = usePalette();
  return (
    <Link href={href as never} asChild>
      <Pressable
        // Flattened: expo-router's <Link asChild> clones this child through
        // <Slot>, which rejects an array style prop.
        style={StyleSheet.flatten([
          styles.row,
          { backgroundColor: palette.cardAlt, borderColor: palette.border },
        ])}>
        <Ionicons name={icon} size={20} color={palette.accent} />
        <View style={styles.rowBody}>
          <View style={styles.rowTitle}>
            <Text style={[styles.rowLabel, { color: palette.text }]}>{label}</Text>
            {!!value && (
              <Text style={[styles.rowValue, { color: palette.textMuted }]}>{value}</Text>
            )}
          </View>
          <Text style={[styles.rowHint, { color: palette.textMuted }]}>{hint}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={palette.textFaint} />
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowValue: { fontSize: 12.5 },
  rowHint: { fontSize: 12.5, lineHeight: 17 },
  footnote: { fontSize: 12, lineHeight: 17, paddingHorizontal: spacing.xs },
});
