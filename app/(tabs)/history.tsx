import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogRow } from '@/components/LogRow';
import { listLogs } from '@/db';
import type { MoodLog } from '@/db';
import { dayHeading, dayKey, fromIso } from '@/lib/dates';
import { spacing, usePalette } from '@/theme';

type Section = { title: string; data: MoodLog[] };

/** Groups logs into local-day sections, newest day first. */
function toSections(logs: MoodLog[]): Section[] {
  const order: string[] = [];
  const grouped = new Map<string, MoodLog[]>();

  for (const log of logs) {
    const created = fromIso(log.createdAt);
    const key = created ? dayKey(created) : 'unknown';
    if (!grouped.has(key)) {
      grouped.set(key, []);
      order.push(key);
    }
    grouped.get(key)!.push(log);
  }

  return order.map((key) => ({
    title: dayHeading(grouped.get(key)![0].createdAt),
    data: grouped.get(key)!,
  }));
}

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<MoodLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const rows = await listLogs(db, 500);
    setLogs(rows);
    setLoaded(true);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const sections = useMemo(() => toSections(logs), [logs]);

  return (
    <SectionList
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xl },
        sections.length === 0 && styles.emptyContent,
      ]}
      sections={sections}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <LogRow log={item} onPress={() => router.navigate(`/log/${item.id}`)} />
      )}
      renderSectionHeader={({ section }) => (
        <View style={[styles.sectionHeader, { backgroundColor: palette.bg }]}>
          <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>
            {section.title}
          </Text>
          <Text style={[styles.sectionCount, { color: palette.textFaint }]}>
            {section.data.length} {section.data.length === 1 ? 'entry' : 'entries'}
          </Text>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      SectionSeparatorComponent={() => <View style={{ height: 2 }} />}
      stickySectionHeadersEnabled
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={palette.textMuted}
        />
      }
      ListEmptyComponent={
        !loaded ? undefined : (
          <View style={styles.empty}>
            <Ionicons name="moon-outline" size={34} color={palette.textFaint} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No entries yet</Text>
            <Text style={[styles.emptyText, { color: palette.textMuted }]}>
              Log how you are doing on the Log tab and it will show up here.
            </Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionCount: { fontSize: 12 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: spacing.sm },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
