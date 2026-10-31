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
import { RangeSelector, type Range } from '@/components/RangeSelector';
import { TrendChart, type PlotSeries } from '@/components/TrendChart';
import type { SliderField } from '@/forms';
import { useForm } from '@/hooks/useForm';
import { rangeStart, toIso } from '@/lib/dates';
import {
  buildDailyData,
  frequencyHint,
  summarize,
  type HabitSummary,
  type SliderSummary,
} from '@/lib/stats';
import { listEntries, type Entry } from '@/store';
import { radius, seriesColor, spacing, useIsDark, usePalette } from '@/theme';

export default function TrendsScreen() {
  const db = useSQLiteContext();
  const palette = usePalette();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const { form, visibleFields } = useForm();

  const [range, setRange] = useState<Range>(7);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [chartWidth, setChartWidth] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const rows = await listEntries(db, form.fields, {
      since: toIso(rangeStart(range)),
      order: 'oldest',
    });
    setEntries(rows);
    setLoaded(true);
  }, [db, form.fields, range]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /** Sliders the user asked to chart, in form order. */
  const charted = useMemo(
    () =>
      visibleFields.filter(
        (field): field is SliderField => field.kind === 'slider' && field.chart
      ),
    [visibleFields]
  );

  const sliders = useMemo(
    () => visibleFields.filter((field): field is SliderField => field.kind === 'slider'),
    [visibleFields]
  );

  const data = useMemo(
    () => buildDailyData(entries, sliders, range),
    [entries, sliders, range]
  );
  const summary = useMemo(
    () => summarize(visibleFields, entries, data),
    [visibleFields, entries, data]
  );

  const visibleCharted = useMemo(
    () => charted.filter((field) => !hidden.has(field.id)),
    [charted, hidden]
  );

  const plot = useMemo<PlotSeries[]>(() => {
    const byField = new Map(data.series.map((item) => [item.field.id, item.values]));
    return visibleCharted.map((field, index) => {
      // Colour by position in the full charted list, so toggling one off does
      // not recolour the others.
      const colorIndex = charted.findIndex((candidate) => candidate.id === field.id);
      return {
        fieldId: field.id,
        label: field.label,
        color: seriesColor(colorIndex, isDark),
        values: byField.get(field.id) ?? [],
        dashed: colorIndex % 2 === 1,
        filled: index === 0,
      };
    });
  }, [visibleCharted, charted, data.series, isDark]);

  const bounds = useMemo(() => {
    if (visibleCharted.length === 0) return { min: 0, max: 10 };
    return {
      min: Math.min(...visibleCharted.map((field) => field.min)),
      max: Math.max(...visibleCharted.map((field) => field.max)),
    };
  }, [visibleCharted]);

  /** Only worth saying when the charted scales actually differ. */
  const mixedScales = useMemo(() => {
    const scales = new Set(visibleCharted.map((field) => `${field.min}-${field.max}`));
    return scales.size > 1;
  }, [visibleCharted]);

  const onChartLayout = useCallback((e: LayoutChangeEvent) => {
    setChartWidth(e.nativeEvent.layout.width);
  }, []);

  const toggle = useCallback((fieldId: string) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  }, []);

  const hasData = summary.totalEntries > 0;

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xl },
      ]}>
      <RangeSelector value={range} onChange={setRange} />

      {charted.length > 0 ? (
        <Card title="Over time" subtitle={`Daily average over the last ${range} days`}>
          <View style={styles.legend}>
            {charted.map((field, index) => (
              <LegendToggle
                key={field.id}
                label={field.label}
                color={seriesColor(index, isDark)}
                active={!hidden.has(field.id)}
                dashed={index % 2 === 1}
                onPress={() => toggle(field.id)}
              />
            ))}
          </View>

          <View onLayout={onChartLayout}>
            {chartWidth > 0 && visibleCharted.length > 0 && (
              <TrendChart
                days={data.days}
                series={plot}
                yMin={bounds.min}
                yMax={bounds.max}
                width={chartWidth}
                height={range > 30 ? 240 : 220}
              />
            )}
          </View>

          {visibleCharted.length === 0 && (
            <Text style={[styles.emptyChart, { color: palette.textMuted }]}>
              Tap a name above to show it again.
            </Text>
          )}

          {loaded && !hasData && (
            <Text style={[styles.emptyChart, { color: palette.textMuted }]}>
              Nothing logged in this window yet.
            </Text>
          )}

          {visibleCharted.length > 0 && (
            <Text style={[styles.footnote, { color: palette.textFaint }]}>
              {mixedScales
                ? `These fields use different scales (${visibleCharted
                    .map((field) => `${field.label} ${field.min}–${field.max}`)
                    .join(', ')}), so the axis spans all of them.`
                : visibleCharted
                    .map(
                      (field) =>
                        `${field.label}: ${field.goodEnd === 'high' ? 'higher' : 'lower'} is better`
                    )
                    .join(' · ')}
            </Text>
          )}
        </Card>
      ) : (
        <Card
          title="Nothing charted yet"
          subtitle={
            sliders.length > 0
              ? 'Your sliders are set not to appear here. Open Settings › Your form and turn on "Show on the Trends chart".'
              : 'Charts need a slider field. Add one in Settings › Your form and it will show up here.'
          }>
          <View />
        </Card>
      )}

      <View style={styles.statGrid}>
        {summary.sliders.map((slider, index) => (
          <SliderStat
            key={slider.field.id}
            summary={slider}
            tint={seriesColor(
              Math.max(0, charted.findIndex((field) => field.id === slider.field.id)),
              isDark
            )}
            fallbackIndex={index}
          />
        ))}
        <View style={[styles.stat, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.statLabel, { color: palette.textMuted }]}>Days logged</Text>
          <Text style={[styles.statValue, { color: palette.accent }]}>
            {summary.daysLogged}
          </Text>
          <Text style={[styles.statHint, { color: palette.textFaint }]}>
            {`of ${range} · ${summary.totalEntries} ${summary.totalEntries === 1 ? 'entry' : 'entries'}`}
          </Text>
        </View>
      </View>

      {summary.habits.length > 0 && (
        <Card title="Everything else in this window">
          {summary.habits.map((habit) => (
            <HabitRow key={habit.field.id} habit={habit} range={range} />
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

function SliderStat({
  summary,
  tint,
  fallbackIndex,
}: {
  summary: SliderSummary;
  tint: string;
  fallbackIndex: number;
}) {
  const palette = usePalette();
  const isDark = useIsDark();
  const color = summary.field.chart ? tint : seriesColor(fallbackIndex, isDark);

  return (
    <View
      style={[styles.stat, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text style={[styles.statLabel, { color: palette.textMuted }]} numberOfLines={1}>
        {summary.field.label}
      </Text>
      <Text style={[styles.statValue, { color }]}>
        {summary.average === null ? '–' : summary.average.toFixed(1)}
      </Text>
      <Text style={[styles.statHint, { color: palette.textFaint }]}>
        {summary.min !== null && summary.max !== null
          ? `range ${summary.min}–${summary.max} of ${summary.field.max}`
          : `out of ${summary.field.max}`}
      </Text>
      {summary.delta !== null && (
        <View style={styles.trendRow}>
          <Ionicons
            name={summary.delta >= 0 ? 'arrow-up' : 'arrow-down'}
            size={12}
            color={summary.improving ? palette.success : palette.danger}
          />
          <Text
            style={[
              styles.trendText,
              { color: summary.improving ? palette.success : palette.danger },
            ]}>
            {`${Math.abs(summary.delta).toFixed(1)} vs earlier half`}
          </Text>
        </View>
      )}
    </View>
  );
}

function LegendToggle({
  label,
  color,
  active,
  onPress,
  dashed,
}: {
  label: string;
  color: string;
  active: boolean;
  onPress: () => void;
  dashed: boolean;
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
                  {
                    backgroundColor: active ? color : palette.textFaint,
                    opacity: active ? 1 : 0.4,
                  },
                ]}
              />
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.solid,
              {
                backgroundColor: active ? color : palette.textFaint,
                opacity: active ? 1 : 0.4,
              },
            ]}
          />
        )}
      </View>
      <Text
        style={[styles.legendLabel, { color: active ? palette.text : palette.textFaint }]}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const HABIT_ICONS: Record<HabitSummary['kind'], keyof typeof Ionicons.glyphMap> = {
  yesno: 'checkmark-done-outline',
  datetime: 'time-outline',
  text: 'document-text-outline',
  words: 'chatbubble-ellipses-outline',
};

function describeHabit(habit: HabitSummary, range: number): string {
  switch (habit.kind) {
    case 'yesno':
      return habit.answered === 0
        ? 'Not answered yet'
        : `${habit.yes} of ${habit.answered} ${habit.answered === 1 ? 'entry' : 'entries'} said yes`;
    case 'datetime':
      return habit.events === 0
        ? 'None recorded'
        : `${habit.events}× · ${frequencyHint(habit.events, range)}`;
    case 'text':
      return habit.entries === 0
        ? 'Nothing written'
        : `${habit.entries} ${habit.entries === 1 ? 'entry' : 'entries'}`;
    case 'words':
      return habit.top.length === 0
        ? 'No words yet'
        : habit.top.map((item) => `${item.word} ×${item.count}`).join(', ');
  }
}

function HabitRow({ habit, range }: { habit: HabitSummary; range: number }) {
  const palette = usePalette();
  return (
    <View style={styles.habitRow}>
      <Ionicons name={HABIT_ICONS[habit.kind]} size={18} color={palette.textMuted} />
      <Text style={[styles.habitLabel, { color: palette.text }]} numberOfLines={1}>
        {habit.field.label}
      </Text>
      <Text
        style={[styles.habitValue, { color: palette.textMuted }]}
        numberOfLines={1}>
        {describeHabit(habit, range)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendSwatch: { width: 20, alignItems: 'center', justifyContent: 'center' },
  solid: { width: 18, height: 3, borderRadius: 2 },
  dashRow: { flexDirection: 'row', gap: 2.5 },
  dash: { width: 4, height: 3, borderRadius: 2 },
  legendLabel: { fontSize: 13, fontWeight: '600', maxWidth: 130 },
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
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  trendText: { fontSize: 11.5, fontWeight: '600' },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  habitLabel: { fontSize: 14.5, fontWeight: '600', flexShrink: 1 },
  habitValue: { fontSize: 13, flex: 1, textAlign: 'right' },
});
