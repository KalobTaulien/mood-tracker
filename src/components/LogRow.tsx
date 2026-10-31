import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  leadFields,
  sliderGoodness,
  summaryTags,
  type FormField,
} from '../forms';
import { formatTime } from '../lib/dates';
import { radius, scoreColor, spacing, useIsDark, usePalette } from '../theme';
import type { Entry } from '../store';

type Props = {
  entry: Entry;
  fields: readonly FormField[];
  onPress: () => void;
};

export function LogRow({ entry, fields, onPress }: Props) {
  const palette = usePalette();
  const isDark = useIsDark();

  const { slider, headline } = leadFields(fields);
  const score = slider ? entry.values[slider.id] : undefined;
  const hasScore = slider !== null && typeof score === 'number';
  const tint = hasScore
    ? scoreColor(sliderGoodness(slider, score as number) * 10, isDark)
    : palette.textFaint;

  const headlineValue = headline ? entry.values[headline.id] : undefined;
  const headlineText =
    typeof headlineValue === 'string' && headlineValue.trim()
      ? headlineValue.trim()
      : hasScore
        ? 'No word'
        : 'Notes only';

  const tags = summaryTags(fields, entry.values, {
    skipFieldIds: [slider?.id, headline?.id].filter((id): id is string => !!id),
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      <View style={[styles.score, { backgroundColor: hasScore ? tint : palette.cardAlt }]}>
        <Text style={[styles.scoreText, { color: hasScore ? '#FFFFFF' : palette.textFaint }]}>
          {hasScore ? String(score) : '–'}
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.word, { color: palette.text }]} numberOfLines={1}>
            {headlineText}
          </Text>
          <Text style={[styles.time, { color: palette.textFaint }]}>
            {formatTime(entry.createdAt)}
          </Text>
        </View>
        {tags.length > 0 && (
          <Text style={[styles.tags, { color: palette.textMuted }]} numberOfLines={1}>
            {tags.join(' · ')}
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={17} color={palette.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  score: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: { fontSize: 18, fontWeight: '700' },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  word: { fontSize: 15.5, fontWeight: '600', flex: 1 },
  time: { fontSize: 12.5, fontWeight: '500' },
  tags: { fontSize: 12.5 },
});
