import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { radius, spacing, usePalette } from '../theme';

type Props = {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Color for the active track and thumb at the current value. */
  tint: string;
  /** Rendered under the track when a value is set. */
  caption?: string;
  minLabel: string;
  maxLabel: string;
};

const STEPS = 11; // 0..10
const THUMB = 28;

/**
 * A 0-10 stepped slider built on PanResponder so there is no extra native dependency.
 * Tapping the active number again clears the value, keeping the field optional.
 */
export function ScoreSlider({ value, onChange, tint, caption, minLabel, maxLabel }: Props) {
  const palette = usePalette();
  const [width, setWidth] = useState(0);
  const lastEmitted = useRef<number | null>(value);
  /** locationX where the drag began, so moves can be offset by gesture.dx. */
  const grantX = useRef(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const emit = useCallback(
    (next: number) => {
      if (lastEmitted.current !== next) {
        lastEmitted.current = next;
        if (Platform.OS !== 'web') {
          Haptics.selectionAsync().catch(() => {});
        }
        onChange(next);
      }
    },
    [onChange]
  );

  // The thumb centre travels between THUMB/2 and width - THUMB/2 so it never
  // overhangs the track; hit-testing uses the same inset range.
  const travel = Math.max(1, width - THUMB);

  const valueFromX = useCallback(
    (x: number) => {
      if (width <= 0) return 0;
      const ratio = Math.max(0, Math.min(1, (x - THUMB / 2) / travel));
      return Math.round(ratio * (STEPS - 1));
    },
    [width, travel]
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          lastEmitted.current = null;
          grantX.current = e.nativeEvent.locationX;
          emit(valueFromX(grantX.current));
        },
        onPanResponderMove: (_e, gesture) => {
          // locationX drifts to whichever subview is under the finger mid-drag,
          // so track from the grant point plus total travel instead.
          emit(valueFromX(grantX.current + gesture.dx));
        },
      }),
    [emit, valueFromX]
  );

  const hasValue = value !== null;
  const ratio = hasValue ? value / (STEPS - 1) : 0;
  const thumbCenter = width > 0 ? THUMB / 2 + ratio * travel : 0;
  const fillWidth = hasValue ? thumbCenter : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: hasValue ? tint : palette.textFaint }]}>
          {hasValue ? value : '–'}
          <Text style={[styles.valueMax, { color: palette.textFaint }]}>/10</Text>
        </Text>
        {hasValue && (
          <Pressable
            onPress={() => {
              lastEmitted.current = null;
              onChange(null);
            }}
            hitSlop={8}
            style={[styles.clear, { backgroundColor: palette.cardAlt }]}>
            <Text style={[styles.clearText, { color: palette.textMuted }]}>Clear</Text>
          </Pressable>
        )}
      </View>

      {!!caption && (
        <Text style={[styles.caption, { color: hasValue ? tint : palette.textFaint }]}>
          {caption}
        </Text>
      )}

      <View style={styles.trackArea} onLayout={onLayout} {...responder.panHandlers}>
        <View style={[styles.track, { backgroundColor: palette.cardAlt }]}>
          {hasValue && (
            <View style={[styles.fill, { width: fillWidth, backgroundColor: tint }]} />
          )}
        </View>
        <View style={styles.ticks} pointerEvents="none">
          {Array.from({ length: STEPS }, (_, i) => (
            <View
              key={i}
              style={[
                styles.tick,
                {
                  backgroundColor:
                    hasValue && i <= value ? 'rgba(255,255,255,0.55)' : palette.textFaint,
                  opacity: hasValue && i <= value ? 1 : 0.35,
                },
              ]}
            />
          ))}
        </View>
        {hasValue && width > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                left: thumbCenter - THUMB / 2,
                backgroundColor: palette.card,
                borderColor: tint,
              },
            ]}
          />
        )}
      </View>

      <View style={styles.labels}>
        <Text style={[styles.label, { color: palette.textFaint }]}>{minLabel}</Text>
        <Text style={[styles.label, { color: palette.textFaint }]}>{maxLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { fontSize: 34, fontWeight: '700', letterSpacing: -1 },
  valueMax: { fontSize: 16, fontWeight: '600', letterSpacing: 0 },
  clear: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  clearText: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 15, fontWeight: '600', marginTop: -spacing.xs },
  trackArea: { height: 44, justifyContent: 'center', marginTop: spacing.xs },
  track: { height: 12, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 12, borderRadius: radius.pill },
  ticks: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: THUMB / 2 - 1,
  },
  tick: { width: 2, height: 2, borderRadius: 1 },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 12, fontWeight: '500' },
});
