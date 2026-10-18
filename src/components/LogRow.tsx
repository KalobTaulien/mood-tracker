import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MoodLog } from '../db/types';
import { formatTime } from '../lib/dates';
import { radius, scoreColor, spacing, useIsDark, usePalette } from '../theme';

type Props = {
  log: MoodLog;
  onPress: () => void;
};

/** Compact tags summarising which optional fields this log actually carries. */
function tagsFor(log: MoodLog): string[] {
  const tags: string[] = [];
  const fatigueWord = log.fatigueWord?.trim().toLowerCase();
  if (log.fatigueScore !== null) {
    tags.push(
      fatigueWord
        ? `fatigue ${log.fatigueScore} · ${fatigueWord}`
        : `fatigue ${log.fatigueScore}`
    );
  } else if (fatigueWord) {
    tags.push(fatigueWord);
  }
  if (log.exercised === 1) tags.push('exercised');
  if (log.exercised === 0) tags.push('no exercise');
  if (log.lonelyAt) tags.push('loneliness');
  if (log.selfHarmThoughts?.trim()) tags.push('self-harm note');
  if (log.lastVegetableAt) tags.push('veg');
  if (log.lastJunkFoodAt) tags.push('junk food');
  if (log.lastProcessedSugarAt) tags.push('sugar');
  return tags;
}

export function LogRow({ log, onPress }: Props) {
  const palette = usePalette();
  const isDark = useIsDark();
  const hasMood = log.moodScore !== null;
  const tint = hasMood ? scoreColor(log.moodScore!, isDark) : palette.textFaint;
  const tags = tagsFor(log);

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
      <View style={[styles.score, { backgroundColor: hasMood ? tint : palette.cardAlt }]}>
        <Text style={[styles.scoreText, { color: hasMood ? '#FFFFFF' : palette.textFaint }]}>
          {hasMood ? log.moodScore : '–'}
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.word, { color: palette.text }]} numberOfLines={1}>
            {log.moodWord?.trim() || (hasMood ? 'No word' : 'Notes only')}
          </Text>
          <Text style={[styles.time, { color: palette.textFaint }]}>
            {formatTime(log.createdAt)}
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
