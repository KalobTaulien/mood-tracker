import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { DateTimeField } from '@/components/DateTimeField';
import { NotesField } from '@/components/NotesField';
import { ScoreSlider } from '@/components/ScoreSlider';
import { WordPicker } from '@/components/WordPicker';
import { YesNoField } from '@/components/YesNoField';
import { deleteLog, getLog, updateLog } from '@/db';
import type { MoodLog, MoodLogDraft } from '@/db';
import { formatDateTime, relativeFromNow } from '@/lib/dates';
import { fatigueWordsFor, moodWordsFor } from '@/lib/mood';
import { radius, scoreColor, spacing, useIsDark, usePalette } from '@/theme';

function toDraft(log: MoodLog): MoodLogDraft {
  const { id, createdAt, updatedAt, ...rest } = log;
  return rest;
}

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const logId = Number(id);
  const db = useSQLiteContext();
  const palette = usePalette();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [log, setLog] = useState<MoodLog | null>(null);
  const [draft, setDraft] = useState<MoodLogDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const found = Number.isFinite(logId) ? await getLog(db, logId) : null;
      if (!active) return;
      setLog(found);
      setDraft(found ? toDraft(found) : null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [db, logId]);

  useEffect(() => {
    if (log) {
      navigation.setOptions({ title: formatDateTime(log.createdAt) });
    }
  }, [log, navigation]);

  const patch = useCallback((changes: Partial<MoodLogDraft>) => {
    setDraft((current) => (current ? { ...current, ...changes } : current));
  }, []);

  const dirty = useMemo(() => {
    if (!log || !draft) return false;
    return JSON.stringify(toDraft(log)) !== JSON.stringify(draft);
  }, [log, draft]);

  const onSave = useCallback(async () => {
    if (!draft || !dirty || saving) return;
    setSaving(true);
    try {
      await updateLog(db, logId, draft);
      const refreshed = await getLog(db, logId);
      setLog(refreshed);
      setDraft(refreshed ? toDraft(refreshed) : draft);
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {}
        );
      }
    } finally {
      setSaving(false);
    }
  }, [db, draft, dirty, logId, saving]);

  const onDelete = useCallback(() => {
    Alert.alert('Delete this entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteLog(db, logId);
          router.back();
        },
      },
    ]);
  }, [db, logId]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (!log || !draft) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg }]}>
        <Ionicons name="help-circle-outline" size={34} color={palette.textFaint} />
        <Text style={[styles.missingTitle, { color: palette.text }]}>Entry not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.link, { color: palette.accent }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const moodTint =
    draft.moodScore === null ? palette.accent : scoreColor(draft.moodScore, isDark);
  const fatigueTint =
    draft.fatigueScore === null
      ? palette.fatigue
      : scoreColor(10 - draft.fatigueScore, isDark);

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
        <View style={styles.meta}>
          <Text style={[styles.metaPrimary, { color: palette.text }]}>
            {formatDateTime(log.createdAt)}
          </Text>
          <Text style={[styles.metaSecondary, { color: palette.textMuted }]}>
            Logged {relativeFromNow(log.createdAt)}
            {log.updatedAt !== log.createdAt
              ? ` · edited ${relativeFromNow(log.updatedAt)}`
              : ''}
          </Text>
        </View>

        <Card title="Mood" subtitle="0 is the worst you have felt, 10 the best.">
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

        <Card title="Fatigue" subtitle="0 is fully rested, 10 is an emotional or physical crash.">
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
          <NotesField
            value={draft.lonelyNote}
            onChange={(lonelyNote) => patch({ lonelyNote })}
            placeholder="Anything you want to add about it?"
          />
        </Card>

        <Card title="Movement" subtitle="Any exercise since the previous log?">
          <YesNoField value={draft.exercised} onChange={(exercised) => patch({ exercised })} />
          {draft.exercised !== null && (
            <NotesField
              value={draft.exerciseNote}
              onChange={(exerciseNote) => patch({ exerciseNote })}
              placeholder={draft.exercised === 1 ? 'What did you do?' : 'What got in the way?'}
              minHeight={60}
            />
          )}
        </Card>

        <Card
          title="Thoughts of self-harm"
          subtitle="Anything recently, in your own words.">
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
        </Card>

        <Card title="Junk food" subtitle="Last time you ate fast food or something you'd call junk.">
          <DateTimeField
            value={draft.lastJunkFoodAt}
            onChange={(lastJunkFoodAt) => patch({ lastJunkFoodAt })}
            emptyLabel="Pick when you last ate junk food"
          />
          <NotesField
            value={draft.junkFoodNote}
            onChange={(junkFoodNote) => patch({ junkFoodNote })}
            placeholder="What was it? (optional)"
            minHeight={60}
          />
        </Card>

        <Card
          title="Processed sugar"
          subtitle="Last time you had added sugar. Sugar from whole fruit does not count.">
          <DateTimeField
            value={draft.lastProcessedSugarAt}
            onChange={(lastProcessedSugarAt) => patch({ lastProcessedSugarAt })}
            emptyLabel="Pick when you last had processed sugar"
          />
          <NotesField
            value={draft.processedSugarNote}
            onChange={(processedSugarNote) => patch({ processedSugarNote })}
            placeholder="What was it? (optional)"
            minHeight={60}
          />
        </Card>

        <Pressable
          onPress={onDelete}
          style={({ pressed }) => [
            styles.deleteButton,
            {
              backgroundColor: palette.dangerSoft,
              borderColor: palette.danger,
              opacity: pressed ? 0.8 : 1,
            },
          ]}>
          <Ionicons name="trash-outline" size={17} color={palette.danger} />
          <Text style={[styles.deleteText, { color: palette.danger }]}>Delete entry</Text>
        </Pressable>
      </ScrollView>

      {dirty && (
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
            disabled={saving}
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: palette.accent, opacity: pressed ? 0.85 : 1 },
            ]}>
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save changes'}</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  missingTitle: { fontSize: 17, fontWeight: '600' },
  link: { fontSize: 15, fontWeight: '600' },
  content: { padding: spacing.lg, gap: spacing.lg },
  meta: { gap: 2 },
  metaPrimary: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  metaSecondary: { fontSize: 13 },
  supportNote: { fontSize: 12, lineHeight: 17 },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    marginTop: spacing.sm,
  },
  deleteText: { fontSize: 15, fontWeight: '600' },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  saveButton: { borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center' },
  saveText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
