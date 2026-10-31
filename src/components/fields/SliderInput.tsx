import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { SliderField } from '../../forms';
import { radius, spacing, usePalette } from '../../theme';

type Props = {
  field: SliderField;
  value: number | null;
  onChange: (value: number | null) => void;
  /** Colour for the active track and thumb at the current value. */
  tint: string;
};

const THUMB = 28;
/** Above this many steps the tick marks stop being legible, so they are dropped. */
const MAX_TICKS = 21;

/**
 * A stepped slider over the field's own range, built on PanResponder so there
 * is no extra native dependency. Tapping "Clear" removes the value, keeping
 * the field optional.
 */
export function SliderInput({ field, value, onChange, tint }: Props) {
  const palette = usePalette();
  const [width, setWidth] = useState(0);
  const lastEmitted = useRef<number | null>(value);
  /** locationX where the drag began, so moves can be offset by gesture.dx. */
  const grantX = useRef(0);

  const steps = field.max - field.min + 1;

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
      if (width <= 0) return field.min;
      const ratio = Math.max(0, Math.min(1, (x - THUMB / 2) / travel));
      return field.min + Math.round(ratio * (steps - 1));
    },
    [width, travel, field.min, steps]
  );

  // Callers pass an inline onChange, so emit/valueFromX get new identities on
  // every render. The PanResponder must NOT be rebuilt from them: replacing it
  // mid-drag hands the in-flight touch a fresh gestureState that never saw the
  // grant, so gesture.dx stays 0 and the value sticks at the grant point.
  // Keep the instance permanent and read the current logic through this ref.
  //
  // Both refs below are deliberately written and read during render: the
  // PanResponder has to outlive every re-render for a drag to survive one, and
  // the only way to give a permanent handler fresh logic is a ref updated in
  // place. react-hooks/refs has no way to express "stable across renders".
  /* eslint-disable react-hooks/refs */
  const latest = useRef({ emit, valueFromX });
  latest.current = { emit, valueFromX };

  const responderRef = useRef<ReturnType<typeof PanResponder.create> | null>(null);
  if (responderRef.current === null) {
    responderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // The form is a ScrollView; don't let it steal a drag already in progress.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        lastEmitted.current = null;
        grantX.current = e.nativeEvent.locationX;
        latest.current.emit(latest.current.valueFromX(grantX.current));
      },
      onPanResponderMove: (_e, gesture) => {
        // locationX drifts to whichever subview is under the finger mid-drag,
        // so track from the grant point plus total travel instead.
        latest.current.emit(latest.current.valueFromX(grantX.current + gesture.dx));
      },
    });
  }
  const responder = responderRef.current;
  /* eslint-enable react-hooks/refs */

  const hasValue = value !== null;
  const ratio = hasValue ? (value - field.min) / Math.max(1, steps - 1) : 0;
  const thumbCenter = width > 0 ? THUMB / 2 + ratio * travel : 0;
  const fillWidth = hasValue ? thumbCenter : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: hasValue ? tint : palette.textFaint }]}>
          {hasValue ? value : '–'}
          <Text style={[styles.valueMax, { color: palette.textFaint }]}>/{field.max}</Text>
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

      {/* eslint-disable-next-line react-hooks/refs -- see the PanResponder note above */}
      <View style={styles.trackArea} onLayout={onLayout} {...responder.panHandlers}>
        <View style={[styles.track, { backgroundColor: palette.cardAlt }]}>
          {hasValue && (
            <View style={[styles.fill, { width: fillWidth, backgroundColor: tint }]} />
          )}
        </View>
        {steps <= MAX_TICKS && (
          <View style={styles.ticks} pointerEvents="none">
            {Array.from({ length: steps }, (_, i) => {
              const filled = hasValue && field.min + i <= value;
              return (
                <View
                  key={i}
                  style={[
                    styles.tick,
                    {
                      backgroundColor: filled ? 'rgba(255,255,255,0.55)' : palette.textFaint,
                      opacity: filled ? 1 : 0.35,
                    },
                  ]}
                />
              );
            })}
          </View>
        )}
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
        <Text style={[styles.label, { color: palette.textFaint }]}>{field.minLabel}</Text>
        <Text style={[styles.label, { color: palette.textFaint }]}>{field.maxLabel}</Text>
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
