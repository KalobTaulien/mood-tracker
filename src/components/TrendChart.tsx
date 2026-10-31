import { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { fromIso } from '../lib/dates';
import { segmentsOf } from '../lib/stats';
import { spacing, usePalette } from '../theme';

export type PlotSeries = {
  fieldId: string;
  label: string;
  color: string;
  /** One value per day, oldest first. Null breaks the line. */
  values: (number | null)[];
  /** Dashed lines keep series apart for anyone who cannot rely on colour. */
  dashed: boolean;
  /** Soft area fill under the line. Only the first series gets one. */
  filled: boolean;
};

type Props = {
  /** Local day keys, oldest first — same length as every series' values. */
  days: string[];
  series: PlotSeries[];
  yMin: number;
  yMax: number;
  width: number;
  height?: number;
};

const PAD = { top: 10, right: 10, bottom: 24, left: 32 };

function labelForDay(day: string): string {
  const date = fromIso(`${day}T12:00:00`);
  if (!date) return day;
  return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

/**
 * Gridline values across [min, max], snapped to a readable step.
 *
 * The scale comes from whatever sliders the user chose to chart, so it cannot
 * be the hard-coded 0,2,4,6,8,10 it used to be — a 1–7 scale needs different
 * ticks than a 0–100 one.
 */
function ticksFor(min: number, max: number, target = 6): number[] {
  const span = max - min;
  if (span <= 0) return [min];

  const rough = span / (target - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= rough) ??
    10 * magnitude;

  const ticks: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max + 1e-9; value += step) {
    ticks.push(Math.round(value * 100) / 100);
  }
  // Always anchor the ends, so the plot area reads as bounded by the scale.
  if (ticks[0] !== min) ticks.unshift(min);
  if (ticks[ticks.length - 1] !== max) ticks.push(max);
  return ticks;
}

export function TrendChart({ days, series, yMin, yMax, width, height = 220 }: Props) {
  const palette = usePalette();
  const [selected, setSelected] = useState<number | null>(null);
  /** locationX where the scrub began, so moves can be offset by gesture.dx. */
  const grantX = useRef(0);

  const plotWidth = Math.max(1, width - PAD.left - PAD.right);
  const plotHeight = Math.max(1, height - PAD.top - PAD.bottom);
  const lastIndex = Math.max(1, days.length - 1);
  const span = Math.max(1e-9, yMax - yMin);

  const x = (index: number) => PAD.left + (index / lastIndex) * plotWidth;
  const y = (value: number) =>
    PAD.top + plotHeight - ((value - yMin) / span) * plotHeight;

  const plotted = useMemo(
    () => series.map((item) => ({ ...item, segments: segmentsOf(item.values) })),
    [series]
  );

  const toPath = (segment: { index: number; value: number }[]) =>
    segment
      .map((point, i) => `${i === 0 ? 'M' : 'L'}${x(point.index)},${y(point.value)}`)
      .join(' ');

  /** Closed path under a line, for the soft area fill. */
  const toAreaPath = (segment: { index: number; value: number }[]) => {
    if (segment.length < 2) return '';
    const base = PAD.top + plotHeight;
    const first = segment[0];
    const last = segment[segment.length - 1];
    return `${toPath(segment)} L${x(last.index)},${base} L${x(first.index)},${base} Z`;
  };

  const indexFromX = useCallback(
    (locationX: number) => {
      const ratio = (locationX - PAD.left) / plotWidth;
      return Math.max(0, Math.min(lastIndex, Math.round(ratio * lastIndex)));
    },
    [plotWidth, lastIndex]
  );

  // grantX is captured here but only ever touched inside the gesture callbacks
  // below, which run on touch rather than during render. The rule cannot tell
  // a captured ref from one that is read while rendering.
  /* eslint-disable react-hooks/refs */
  const panHandlers = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          grantX.current = e.nativeEvent.locationX;
          setSelected(indexFromX(grantX.current));
        },
        onPanResponderMove: (_e, gesture) =>
          setSelected(indexFromX(grantX.current + gesture.dx)),
        onPanResponderRelease: () => setSelected(null),
        onPanResponderTerminate: () => setSelected(null),
      }).panHandlers,
    [indexFromX]
  );
  /* eslint-enable react-hooks/refs */

  const showDots = days.length <= 14;
  const ticks = useMemo(() => ticksFor(yMin, yMax), [yMin, yMax]);
  const xLabelIndices = useMemo(() => {
    if (days.length <= 1) return [0];
    const count = Math.min(5, days.length);
    return Array.from({ length: count }, (_, i) =>
      Math.round((i / (count - 1)) * (days.length - 1))
    );
  }, [days.length]);

  const firstFilled = plotted.find((item) => item.filled);

  return (
    <View>
      <View {...panHandlers}>
        <Svg width={width} height={height}>
          {firstFilled && (
            <Defs>
              <LinearGradient id="seriesArea" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={firstFilled.color} stopOpacity="0.28" />
                <Stop offset="1" stopColor={firstFilled.color} stopOpacity="0" />
              </LinearGradient>
            </Defs>
          )}

          {ticks.map((tick) => {
            const edge = tick === yMin || tick === yMax;
            return (
              <G key={tick}>
                <Line
                  x1={PAD.left}
                  y1={y(tick)}
                  x2={PAD.left + plotWidth}
                  y2={y(tick)}
                  stroke={palette.border}
                  strokeWidth={edge ? 1 : StyleSheet.hairlineWidth}
                  strokeDasharray={edge ? undefined : '3 4'}
                />
                <SvgText
                  x={PAD.left - 6}
                  y={y(tick) + 3.5}
                  fontSize="10"
                  fill={palette.textFaint}
                  textAnchor="end">
                  {tick}
                </SvgText>
              </G>
            );
          })}

          {xLabelIndices.map((index) => (
            <SvgText
              key={index}
              x={x(index)}
              y={height - 7}
              fontSize="10"
              fill={palette.textFaint}
              textAnchor={
                index === 0 ? 'start' : index === days.length - 1 ? 'end' : 'middle'
              }>
              {labelForDay(days[index] ?? '')}
            </SvgText>
          ))}

          {/* Areas first, so no line is dimmed by a fill drawn over it. */}
          {plotted
            .filter((item) => item.filled)
            .map((item) =>
              item.segments.map((segment, i) => (
                <Path
                  key={`${item.fieldId}-area-${i}`}
                  d={toAreaPath(segment)}
                  fill="url(#seriesArea)"
                />
              ))
            )}

          {plotted.map((item) =>
            item.segments.map((segment, i) => (
              <Path
                key={`${item.fieldId}-line-${i}`}
                d={toPath(segment)}
                stroke={item.color}
                strokeWidth={item.filled ? 2.5 : 2}
                strokeDasharray={item.dashed ? '5 4' : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))
          )}

          {/* A single logged day has no line to draw, so mark the point itself. */}
          {plotted.map((item) =>
            item.segments
              .filter((segment) => segment.length === 1)
              .map((segment, i) => (
                <Circle
                  key={`${item.fieldId}-solo-${i}`}
                  cx={x(segment[0].index)}
                  cy={y(segment[0].value)}
                  r={3.5}
                  fill={item.color}
                />
              ))
          )}

          {showDots &&
            plotted.map((item) =>
              item.values.map((value, index) =>
                value === null ? null : (
                  <Circle
                    key={`${item.fieldId}-dot-${index}`}
                    cx={x(index)}
                    cy={y(value)}
                    r={3.2}
                    fill={palette.card}
                    stroke={item.color}
                    strokeWidth={1.9}
                  />
                )
              )
            )}

          {selected !== null && (
            <G>
              <Line
                x1={x(selected)}
                y1={PAD.top}
                x2={x(selected)}
                y2={PAD.top + plotHeight}
                stroke={palette.textFaint}
                strokeWidth={1}
              />
              {plotted.map((item) => {
                const value = item.values[selected];
                if (value === null || value === undefined) return null;
                return (
                  <Circle
                    key={`${item.fieldId}-sel`}
                    cx={x(selected)}
                    cy={y(value)}
                    r={5}
                    fill={item.color}
                    stroke={palette.card}
                    strokeWidth={2}
                  />
                );
              })}
            </G>
          )}
        </Svg>
      </View>

      <View style={styles.readout}>
        {selected !== null ? (
          <Text style={[styles.readoutText, { color: palette.textMuted }]}>
            {labelForDay(days[selected] ?? '')}
            {series.map((item) => {
              const value = item.values[selected];
              return (
                <Text key={item.fieldId} style={{ color: item.color }}>
                  {'   '}
                  {item.label.toLowerCase()} {value === null || value === undefined ? '–' : value.toFixed(1)}
                </Text>
              );
            })}
          </Text>
        ) : (
          <Text style={[styles.readoutText, { color: palette.textFaint }]}>
            Touch and drag the chart to read a day
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { alignItems: 'center', paddingTop: spacing.sm, minHeight: 26 },
  readoutText: { fontSize: 12.5, fontWeight: '600' },
});
