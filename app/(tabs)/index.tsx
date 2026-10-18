import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Link, router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { DateTimeField } from '@/components/DateTimeField';
import { NotesField } from '@/components/NotesField';
import { ScoreSlider } from '@/components/ScoreSlider';
import { WordPicker } from '@/components/WordPicker';
import { YesNoField } from '@/components/YesNoField';
import { emptyDraft, insertLog, isDraftEmpty, latestTimestamp, listLogs } from '@/db';
import type { MoodLogDraft } from '@/db';
import { formatDateTime, relativeFromNow } from '@/lib/dates';
import { fatigueWordsFor, moodWordsFor } from '@/lib/mood';
import { radius, scoreColor, spacing, useIsDark, usePalette } from '@/theme';

export default function LogScreen() {
  const db = useSQLiteContext();
  const palette = usePalette();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState<MoodLogDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [lastLogAt, setLastLogAt] = useState<string | null>(null);
  const [previousLonely, setPreviousLonely] = useState<string | null>(null);
  const [previousVegetable, setPreviousVegetable] = useState<string | null>(null);
  const [previousJunkFood, setPreviousJunkFood] = useState<string | null>(null);
  const [previousSugar, setPreviousSugar] = useState<string | null>(null);

  const loadContext = useCallback(async () => {
    const [recent, lonely, vegetable, junkFood, sugar] = await Promise.all([
      listLogs(db, 1),
      latestTimestamp(db, 'lonely_at'),
      latestTimestamp(db, 'last_vegetable_at'),
      latestTimestamp(db, 'last_junk_food_at'),
      latestTimestamp(db, 'last_processed_sugar_at'),
    ]);
    setLastLogAt(recent[0]?.createdAt ?? null);
    setPreviousLonely(lonely);
    setPreviousVegetable(vegetable);
    setPreviousJunkFood(junkFood);
    setPreviousSugar(sugar);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadContext();
    }, [loadContext])
  );

  const patch = useCallback((changes: Partial<MoodLogDraft>) => {
    setSavedId(null);
    setDraft((current) => ({ ...current, ...changes }));
  }, []);

  const moodTint = useMemo(
    () => (draft.moodScore === null ? palette.accent : scoreColor(draft.moodScore, isDark)),
    [draft.moodScore, palette.accent, isDark]
  );
  // Fatigue is inverted: 10 is the bad end, so flip the score before coloring.
  const fatigueTint = useMemo(
    () =>
      draft.fatigueScore === null
        ? palette.fatigue
        : scoreColor(10 - draft.fatigueScore, isDark),
    [draft.fatigueScore, palette.fatigue, isDark]
  );

  const empty = isDraftEmpty(draft);

  const onSave = useCallback(async () => {
    if (empty || saving) return;
    setSaving(true);
    try {
      const id = await insertLog(db, draft);
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {}
        );
      }
      setDraft(emptyDraft());
      setSavedId(id);
      await loadContext();
    } finally {
      setSaving(false);
    }
  }, [db, draft, empty, saving, loadContext]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={[styles.flex, { backgroundColor: palette.bg }]}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xxl * 2 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive">
        <View style={styles.heading}>
          <View style={styles.headingText}>
            <Text style={[styles.title, { color: palette.text }]}>How are you now?</Text>
            <Text style={[styles.subtitle, { color: palette.textMuted }]}>
              {lastLogAt
                ? `Last logged ${relativeFromNow(lastLogAt)}`
                : 'Your first entry — every field is optional.'}
            </Text>
          </View>
          <Link href="/settings" asChild>
            <Pressable
              hitSlop={10}
              // Flattened: expo-router's <Link asChild> clones this child through
              // <Slot>, which rejects an array style prop.
              style={StyleSheet.flatten([
                styles.iconButton,
                { backgroundColor: palette.card, borderColor: palette.border },
              ])}>
              <Ionicons name="notifications-outline" size={19} color={palette.textMuted} />
            </Pressable>
          </Link>
        </View>

        {savedId !== null && (
          <Pressable
            onPress={() => router.navigate(`/log/${savedId}`)}
            style={[styles.savedBanner, { backgroundColor: palette.accentSoft, borderColor: palette.accent }]}>
            <Ionicons name="checkmark-circle" size={20} color={palette.accent} />
            <Text style={[styles.savedText, { color: palette.text }]}>
              Saved. Tap to view this entry.
            </Text>
          </Pressable>
        )}

        <Card
          title="Mood"
          subtitle="0 is the worst you have felt, 10 the best.">
          <ScoreSlider
            value={draft.moodScore}
            onChange={(moodScore) => patch({ moodScore })}
            tint={moodTint}
            minLabel="Worst"
            maxLabel="Best"
          />
          <WordPicker
            suggestions={draft.moodScore === null ? [] : moodWordsFor(draft.moodScore)}
            word={draft.moodWord}
            onChangeWord={(moodWord) => patch({ moodWord })}
            tint={moodTint}
          />
        </Card>

        <Card
          title="Fatigue"
          subtitle="0 is fully rested, 10 is an emotional or physical crash.">
          <ScoreSlider
            value={draft.fatigueScore}
            onChange={(fatigueScore) => patch({ fatigueScore })}
            tint={fatigueTint}
            minLabel="Rested"
            maxLabel="Crash"
          />
          <WordPicker
            suggestions={
              draft.fatigueScore === null ? [] : fatigueWordsFor(draft.fatigueScore)
            }
            word={draft.fatigueWord}
            onChangeWord={(fatigueWord) => patch({ fatigueWord })}
            tint={fatigueTint}
            emptyPlaceholder="A word for how tired you feel"
          />
          <NotesField
            value={draft.fatigueNote}
            onChange={(fatigueNote) => patch({ fatigueNote })}
            placeholder="Anything else about the tiredness? (optional)"
            minHeight={60}
          />
        </Card>

        <Card title="Loneliness" subtitle="Last time you felt lonely.">
          <DateTimeField
            value={draft.lonelyAt}
            onChange={(lonelyAt) => patch({ lonelyAt })}
            emptyLabel="Pick when you last felt lonely"
          />
          {previousLonely && draft.lonelyAt === null && (
            <PreviousHint
              label={`Previously ${formatDateTime(previousLonely)}`}
              onReuse={() => patch({ lonelyAt: previousLonely })}
            />
          )}
          <NotesField
            value={draft.lonelyNote}
            onChange={(lonelyNote) => patch({ lonelyNote })}
            placeholder="Anything you want to add about it?"
          />
        </Card>

        <Card
          title="Movement"
          subtitle={
            lastLogAt
              ? `Any exercise since your last log (${relativeFromNow(lastLogAt)})?`
              : 'Have you exercised a little bit recently?'
          }>
          <YesNoField
            value={draft.exercised}
            onChange={(exercised) => patch({ exercised })}
          />
          {draft.exercised !== null && (
            <NotesField
              value={draft.exerciseNote}
              onChange={(exerciseNote) => patch({ exerciseNote })}
              placeholder={
                draft.exercised === 1 ? 'What did you do?' : 'What got in the way?'
              }
              minHeight={60}
            />
          )}
        </Card>

        <Card
          title="Thoughts of self-harm"
          subtitle="Anything recently, in your own words. Leave it blank if there is nothing.">
          <NotesField
            value={draft.selfHarmThoughts}
            onChange={(selfHarmThoughts) => patch({ selfHarmThoughts })}
            placeholder="What came up, and what it felt like"
            minHeight={90}
          />
          <Text style={[styles.supportNote, { color: palette.textFaint }]}>
            If things feel urgent, call or text 988 (US & Canada) to reach a crisis
            counsellor right away.
          </Text>
        </Card>

        <Card title="Vegetables" subtitle="Last time you ate a vegetable.">
          <DateTimeField
            value={draft.lastVegetableAt}
            onChange={(lastVegetableAt) => patch({ lastVegetableAt })}
            emptyLabel="Pick when you last ate a vegetable"
          />
          {previousVegetable && draft.lastVegetableAt === null && (
            <PreviousHint
              label={`Previously ${formatDateTime(previousVegetable)}`}
              onReuse={() => patch({ lastVegetableAt: previousVegetable })}
            />
          )}
        </Card>

        <Card
          title="Junk food"
          subtitle="Last time you ate fast food or anything you'd call junk — tracked only to show how often it happens.">
          <DateTimeField
            value={draft.lastJunkFoodAt}
            onChange={(lastJunkFoodAt) => patch({ lastJunkFoodAt })}
            emptyLabel="Pick when you last ate junk food"
          />
          {previousJunkFood && draft.lastJunkFoodAt === null && (
            <PreviousHint
              label={`Previously ${formatDateTime(previousJunkFood)}`}
              onReuse={() => patch({ lastJunkFoodAt: previousJunkFood })}
            />
          )}
          <NotesField
            value={draft.junkFoodNote}
            onChange={(junkFoodNote) => patch({ junkFoodNote })}
            placeholder="What was it? (optional)"
            minHeight={60}
          />
        </Card>

        <Card
          title="Processed sugar"
          subtitle="Last time you had added sugar — full-sugar soda, cake, candy, sweetened coffee. Sugar from whole fruit does not count.">
          <DateTimeField
            value={draft.lastProcessedSugarAt}
            onChange={(lastProcessedSugarAt) => patch({ lastProcessedSugarAt })}
            emptyLabel="Pick when you last had processed sugar"
          />
          {previousSugar && draft.lastProcessedSugarAt === null && (
            <PreviousHint
              label={`Previously ${formatDateTime(previousSugar)}`}
              onReuse={() => patch({ lastProcessedSugarAt: previousSugar })}
            />
          )}
          <NotesField
            value={draft.processedSugarNote}
            onChange={(processedSugarNote) => patch({ processedSugarNote })}
            placeholder="What was it? (optional)"
            minHeight={60}
          />
        </Card>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: palette.card,
            borderTopColor: palette.border,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}>
        <Pressable
          onPress={onSave}
          disabled={empty || saving}
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor: empty ? palette.cardAlt : palette.accent,
              opacity: pressed && !empty ? 0.85 : 1,
            },
          ]}>
          <Text
            style={[
              styles.saveText,
              { color: empty ? palette.textFaint : '#FFFFFF' },
            ]}>
            {saving ? 'Saving…' : empty ? 'Fill in anything to save' : 'Save entry'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function PreviousHint({ label, onReuse }: { label: string; onReuse: () => void }) {
  const palette = usePalette();
  return (
    <View style={styles.hintRow}>
      <Text style={[styles.hintText, { color: palette.textFaint }]}>{label}</Text>
      <Chip size="sm" label="Reuse" onPress={onReuse} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  headingText: { flex: 1, gap: 3 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { fontSize: 14 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  savedText: { fontSize: 14, fontWeight: '600', flex: 1 },
  supportNote: { fontSize: 12, lineHeight: 17 },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: -spacing.xs,
  },
  hintText: { fontSize: 12.5, flex: 1 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  saveButton: {
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveText: { fontSize: 16, fontWeight: '700' },
});
