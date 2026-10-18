import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { MoodChart } from '@/components/MoodChart';
import { RangeSelector, type Range } from '@/components/RangeSelector';
import { listLogsSince } from '@/db';
import type { MoodLog } from '@/db';
import { rangeStart, toIso } from '@/lib/dates';
import { buildDailySeries, frequencyHint, summarize } from '@/lib/stats';
import { radius, spacing, usePalette } from '@/theme';

export default function TrendsScreen() {
  const db = useSQLiteContext();
  const palette = usePalette();
  const insets = useSafeAreaInsets();

  const [range, setRange] = useState<Range>(7);
  const [logs, setLogs] = useState<MoodLog[]>([]);
  const [chartWidth, setChartWidth] = useState(0);
  const [showMood, setShowMood] = useState(true);
  const [showFatigue, setShowFatigue] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const rows = await listLogsSince(db, toIso(rangeStart(range)));
    setLogs(rows);
    setLoaded(true);
  }, [db, range]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const series = useMemo(() => buildDailySeries(logs, range), [logs, range]);
  const summary = useMemo(() => summarize(logs, series), [logs, series]);

  const onChartLayout = useCallback((e: LayoutChangeEvent) => {
    setChartWidth(e.nativeEvent.layout.width);
  }, []);

  const hasData = summary.totalLogs > 0;

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xl },
      ]}>
      <RangeSelector value={range} onChange={setRange} />

      <Card
        title="Emotional state"
        subtitle={`Daily average over the last ${range} days`}>
        <View style={styles.legend}>
          <LegendToggle
            label="Mood"
            color={palette.mood}
            active={showMood}
            onPress={() => setShowMood((v) => !v)}
          />
          <LegendToggle
            label="Fatigue"
            color={palette.fatigue}
            active={showFatigue}
            onPress={() => setShowFatigue((v) => !v)}
            dashed
          />
        </View>

        <View onLayout={onChartLayout}>
          {chartWidth > 0 && (
            <MoodChart
              series={series}
              width={chartWidth}
              height={range > 30 ? 240 : 220}
              showMood={showMood}
              showFatigue={showFatigue}
            />
          )}
        </View>

        {loaded && !hasData && (
          <Text style={[styles.emptyChart, { color: palette.textMuted }]}>
            Nothing logged in this window yet.
          </Text>
        )}
        <Text style={[styles.footnote, { color: palette.textFaint }]}>
          Higher mood is better; higher fatigue is worse, where 10 is a full crash.
        </Text>
      </Card>

      <View style={styles.statGrid}>
        <Stat
          label="Avg mood"
          value={summary.avgMood === null ? '–' : summary.avgMood.toFixed(1)}
          tint={palette.mood}
          hint={
            summary.minMood !== null && summary.maxMood !== null
              ? `range ${summary.minMood}–${summary.maxMood}`
              : undefined
          }
        />
        <Stat
          label="Avg fatigue"
          value={summary.avgFatigue === null ? '–' : summary.avgFatigue.toFixed(1)}
          tint={palette.fatigue}
          hint={summary.avgFatigue === null ? undefined : 'out of 10'}
        />
        <Stat
          label="Days logged"
          value={`${summary.daysLogged}`}
          tint={palette.accent}
          hint={`of ${range} · ${summary.totalLogs} entries`}
        />
        <Stat
          label="Mood trend"
          value={
            summary.moodTrend === null
              ? '–'
              : `${summary.moodTrend > 0 ? '+' : ''}${summary.moodTrend.toFixed(1)}`
          }
          tint={
            summary.moodTrend === null
              ? palette.textFaint
              : summary.moodTrend >= 0
                ? palette.success
                : palette.danger
          }
          hint="later half vs earlier"
        />
        <Stat
          label="Junk food"
          value={summary.junkFoodEvents === 0 ? '0' : `${summary.junkFoodEvents}×`}
          tint={summary.junkFoodEvents === 0 ? palette.success : palette.fatigue}
          hint={frequencyHint(summary.junkFoodEvents, range) ?? 'none logged yet'}
        />
        <Stat
          label="Processed sugar"
          value={
            summary.processedSugarEvents === 0 ? '0' : `${summary.processedSugarEvents}×`
          }
          tint={summary.processedSugarEvents === 0 ? palette.success : palette.fatigue}
          hint={frequencyHint(summary.processedSugarEvents, range) ?? 'none logged yet'}
        />
      </View>

      <Card title="Habits in this window">
        <HabitRow
          icon="walk-outline"
          label="Exercised"
          value={
            summary.exerciseAnswered === 0
              ? 'Not tracked yet'
              : `${summary.exerciseYes} of ${summary.exerciseAnswered} logs said yes`
          }
        />
        <HabitRow
          icon="person-outline"
          label="Loneliness noted"
          value={
            summary.lonelyMentions === 0
              ? 'None recorded'
              : `${summary.lonelyMentions} ${summary.lonelyMentions === 1 ? 'entry' : 'entries'}`
          }
        />
        <HabitRow
          icon="nutrition-outline"
          label="Vegetables eaten"
          value={
            summary.vegetableEvents === 0
              ? 'None recorded'
              : `${summary.vegetableEvents}× · ${frequencyHint(summary.vegetableEvents, range)}`
          }
        />
        <HabitRow
          icon="fast-food-outline"
          label="Junk food eaten"
          value={
            summary.junkFoodEvents === 0
              ? 'None recorded'
              : `${summary.junkFoodEvents}× · ${frequencyHint(summary.junkFoodEvents, range)}`
          }
        />
        <HabitRow
          icon="ice-cream-outline"
          label="Processed sugar"
          value={
            summary.processedSugarEvents === 0
              ? 'None recorded'
              : `${summary.processedSugarEvents}× · ${frequencyHint(summary.processedSugarEvents, range)}`
          }
        />
        <HabitRow
          icon="alert-circle-outline"
          label="Self-harm notes"
          value={
            summary.selfHarmMentions === 0
              ? 'None recorded'
              : `${summary.selfHarmMentions} ${summary.selfHarmMentions === 1 ? 'entry' : 'entries'}`
          }
          tint={summary.selfHarmMentions > 0 ? palette.danger : undefined}
        />
      </Card>
    </ScrollView>
  );
}

function LegendToggle({
  label,
  color,
  active,
  onPress,
  dashed = false,
}: {
  label: string;
  color: string;
  active: boolean;
  onPress: () => void;
  dashed?: boolean;
}) {
  const palette = usePalette();
  return (
    <Pressable onPress={onPress} style={styles.legendItem} hitSlop={6}>
      <View style={styles.legendSwatch}>
        {dashed ? (
          <View style={styles.dashRow}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.dash,
                  { backgroundColor: active ? color : palette.textFaint, opacity: active ? 1 : 0.4 },
                ]}
              />
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.solid,
              { backgroundColor: active ? color : palette.textFaint, opacity: active ? 1 : 0.4 },
            ]}
          />
        )}
      </View>
      <Text
        style={[
          styles.legendLabel,
          { color: active ? palette.text : palette.textFaint },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Stat({
  label,
  value,
  tint,
  hint,
}: {
  label: string;
  value: string;
  tint: string;
  hint?: string;
}) {
  const palette = usePalette();
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: palette.card, borderColor: palette.border },
      ]}>
      <Text style={[styles.statLabel, { color: palette.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
      {!!hint && <Text style={[styles.statHint, { color: palette.textFaint }]}>{hint}</Text>}
    </View>
  );
}

function HabitRow({
  icon,
  label,
  value,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tint?: string;
}) {
  const palette = usePalette();
  return (
    <View style={styles.habitRow}>
      <Ionicons name={icon} size={18} color={tint ?? palette.textMuted} />
      <Text style={[styles.habitLabel, { color: palette.text }]}>{label}</Text>
      <Text style={[styles.habitValue, { color: tint ?? palette.textMuted }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  legend: { flexDirection: 'row', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendSwatch: { width: 20, alignItems: 'center', justifyContent: 'center' },
  solid: { width: 18, height: 3, borderRadius: 2 },
  dashRow: { flexDirection: 'row', gap: 2.5 },
  dash: { width: 4, height: 3, borderRadius: 2 },
  legendLabel: { fontSize: 13, fontWeight: '600' },
  emptyChart: { fontSize: 14, textAlign: 'center' },
  footnote: { fontSize: 11.5, lineHeight: 16 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: {
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: 2,
  },
  statLabel: { fontSize: 12.5, fontWeight: '600' },
  statValue: { fontSize: 26, fontWeight: '700', letterSpacing: -0.8 },
  statHint: { fontSize: 11.5 },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  habitLabel: { fontSize: 14.5, fontWeight: '600', flex: 1 },
  habitValue: { fontSize: 13 },
});
