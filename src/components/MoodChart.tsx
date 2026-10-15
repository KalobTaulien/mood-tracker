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
import { segmentsOf, type DayPoint } from '../lib/stats';
import { spacing, usePalette } from '../theme';

type Props = {
  series: DayPoint[];
  width: number;
  height?: number;
  showMood: boolean;
  showFatigue: boolean;
};

const PAD = { top: 10, right: 10, bottom: 24, left: 28 };
const Y_MIN = 0;
const Y_MAX = 10;

function labelForDay(day: string): string {
  const date = fromIso(`${day}T12:00:00`);
  if (!date) return day;
  return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

export function MoodChart({ series, width, height = 220, showMood, showFatigue }: Props) {
  const palette = usePalette();
  const [selected, setSelected] = useState<number | null>(null);
  /** locationX where the scrub began, so moves can be offset by gesture.dx. */
  const grantX = useRef(0);
  const plotWidth = Math.max(1, width - PAD.left - PAD.right);
  const plotHeight = Math.max(1, height - PAD.top - PAD.bottom);
  const lastIndex = Math.max(1, series.length - 1);

  const x = (index: number) => PAD.left + (index / lastIndex) * plotWidth;
  const y = (value: number) =>
    PAD.top + plotHeight - ((value - Y_MIN) / (Y_MAX - Y_MIN)) * plotHeight;

  const moodSegments = useMemo(() => segmentsOf(series, (p) => p.mood), [series]);
  const fatigueSegments = useMemo(() => segmentsOf(series, (p) => p.fatigue), [series]);

  const toPath = (segment: { index: number; value: number }[]) =>
    segment
      .map((point, i) => `${i === 0 ? 'M' : 'L'}${x(point.index)},${y(point.value)}`)
      .join(' ');

  /** Closed path under the mood line, for the soft area fill. */
  const toAreaPath = (segment: { index: number; value: number }[]) => {
    if (segment.length < 2) return '';
    const base = PAD.top + plotHeight;
    const line = toPath(segment);
    const first = segment[0];
    const last = segment[segment.length - 1];
    return `${line} L${x(last.index)},${base} L${x(first.index)},${base} Z`;
  };

  const indexFromX = useCallback(
    (locationX: number) => {
      const ratio = (locationX - PAD.left) / plotWidth;
      return Math.max(0, Math.min(lastIndex, Math.round(ratio * lastIndex)));
    },
    [plotWidth, lastIndex]
  );

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

  const showDots = series.length <= 14;
  const selectedPoint = selected !== null ? series[selected] : null;
  const xLabelIndices = useMemo(() => {
    if (series.length <= 1) return [0];
    const count = Math.min(5, series.length);
    return Array.from({ length: count }, (_, i) =>
      Math.round((i / (count - 1)) * (series.length - 1))
    );
  }, [series.length]);

  return (
    <View>
      <View {...panHandlers}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="moodArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={palette.mood} stopOpacity="0.28" />
              <Stop offset="1" stopColor={palette.mood} stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {/* horizontal gridlines + y labels */}
          {[0, 2, 4, 6, 8, 10].map((tick) => (
            <G key={tick}>
              <Line
                x1={PAD.left}
                y1={y(tick)}
                x2={PAD.left + plotWidth}
                y2={y(tick)}
                stroke={palette.border}
                strokeWidth={tick === 0 || tick === 10 ? 1 : StyleSheet.hairlineWidth}
                strokeDasharray={tick === 0 || tick === 10 ? undefined : '3 4'}
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
          ))}

          {/* x labels */}
          {xLabelIndices.map((index) => (
            <SvgText
              key={index}
              x={x(index)}
              y={height - 7}
              fontSize="10"
              fill={palette.textFaint}
              textAnchor={index === 0 ? 'start' : index === series.length - 1 ? 'end' : 'middle'}>
              {labelForDay(series[index]?.day ?? '')}
            </SvgText>
          ))}

          {showMood &&
            moodSegments.map((segment, i) => (
              <Path key={`mood-area-${i}`} d={toAreaPath(segment)} fill="url(#moodArea)" />
            ))}

          {showFatigue &&
            fatigueSegments.map((segment, i) => (
              <Path
                key={`fatigue-${i}`}
                d={toPath(segment)}
                stroke={palette.fatigue}
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinecap="round"
                fill="none"
              />
            ))}

          {showMood &&
            moodSegments.map((segment, i) => (
              <Path
                key={`mood-${i}`}
                d={toPath(segment)}
                stroke={palette.mood}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}

          {/* isolated single-day segments still need a visible marker */}
          {showMood &&
            moodSegments
              .filter((s) => s.length === 1)
              .map((segment, i) => (
                <Circle
                  key={`mood-solo-${i}`}
                  cx={x(segment[0].index)}
                  cy={y(segment[0].value)}
                  r={3.5}
                  fill={palette.mood}
                />
              ))}
          {showFatigue &&
            fatigueSegments
              .filter((s) => s.length === 1)
              .map((segment, i) => (
                <Circle
                  key={`fatigue-solo-${i}`}
                  cx={x(segment[0].index)}
                  cy={y(segment[0].value)}
                  r={3.5}
                  fill={palette.fatigue}
                />
              ))}

          {showDots &&
            series.map((point) => (
              <G key={`dots-${point.index}`}>
                {showMood && point.mood !== null && (
                  <Circle
                    cx={x(point.index)}
                    cy={y(point.mood)}
                    r={3.5}
                    fill={palette.card}
                    stroke={palette.mood}
                    strokeWidth={2}
                  />
                )}
                {showFatigue && point.fatigue !== null && (
                  <Circle
                    cx={x(point.index)}
                    cy={y(point.fatigue)}
                    r={3}
                    fill={palette.card}
                    stroke={palette.fatigue}
                    strokeWidth={1.8}
                  />
                )}
              </G>
            ))}

          {/* scrub indicator */}
          {selectedPoint && (
            <G>
              <Line
                x1={x(selectedPoint.index)}
                y1={PAD.top}
                x2={x(selectedPoint.index)}
                y2={PAD.top + plotHeight}
                stroke={palette.textFaint}
                strokeWidth={1}
              />
              {showMood && selectedPoint.mood !== null && (
                <Circle
                  cx={x(selectedPoint.index)}
                  cy={y(selectedPoint.mood)}
                  r={5}
                  fill={palette.mood}
                  stroke={palette.card}
                  strokeWidth={2}
                />
              )}
              {showFatigue && selectedPoint.fatigue !== null && (
                <Circle
                  cx={x(selectedPoint.index)}
                  cy={y(selectedPoint.fatigue)}
                  r={5}
                  fill={palette.fatigue}
                  stroke={palette.card}
                  strokeWidth={2}
                />
              )}
            </G>
          )}
        </Svg>
      </View>

      <View style={styles.readout}>
        {selectedPoint ? (
          <Text style={[styles.readoutText, { color: palette.textMuted }]}>
            {labelForDay(selectedPoint.day)}
            {'   '}
            {showMood && (
              <Text style={{ color: palette.mood }}>
                mood {selectedPoint.mood !== null ? selectedPoint.mood.toFixed(1) : '–'}
              </Text>
            )}
            {showMood && showFatigue ? '   ' : ''}
            {showFatigue && (
              <Text style={{ color: palette.fatigue }}>
                fatigue {selectedPoint.fatigue !== null ? selectedPoint.fatigue.toFixed(1) : '–'}
              </Text>
            )}
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
