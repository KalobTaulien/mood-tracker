import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STARTER_CHOICES } from '@/forms';
import { useForm } from '@/hooks/useForm';
import { radius, spacing, usePalette } from '@/theme';

/**
 * First run.
 *
 * Shown whenever no form document exists — a fresh install, or after erasing
 * everything. Picking a starting point is what creates the document, which is
 * also the flag that sends the tabs layout on through to the app.
 */
export default function OnboardingScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { save } = useForm();
  const [choosing, setChoosing] = useState<string | null>(null);

  const choose = useCallback(
    async (key: string, build: () => ReturnType<typeof STARTER_CHOICES[number]['build']>) => {
      if (choosing) return;
      setChoosing(key);
      try {
        await save(build());
        router.replace('/');
      } finally {
        setChoosing(null);
      }
    },
    [choosing, save]
  );

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}>
      <View style={styles.hero}>
        <View style={[styles.mark, { backgroundColor: palette.accentSoft }]}>
          <Ionicons name="moon" size={26} color={palette.accent} />
        </View>
        <Text style={[styles.title, { color: palette.text }]}>
          A journal only you can read
        </Text>
        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
          Everything you write stays on this phone. There is no account, no sync, and
          nothing is ever uploaded.
        </Text>
      </View>

      <View style={[styles.privacy, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Ionicons name="lock-closed" size={16} color={palette.success} />
        <Text style={[styles.privacyText, { color: palette.textMuted }]}>
          Because nothing is stored elsewhere, deleting the app deletes the journal.
          You can export a backup file any time from Settings.
        </Text>
      </View>

      <View style={styles.choices}>
        <Text style={[styles.choicesTitle, { color: palette.text }]}>
          What do you want to track?
        </Text>
        <Text style={[styles.choicesHint, { color: palette.textMuted }]}>
          Pick a starting point. Every field is editable afterwards — add, rename,
          reorder, or remove whatever you like.
        </Text>

        {STARTER_CHOICES.map((choice) => (
          <Pressable
            key={choice.key}
            onPress={() => choose(choice.key, choice.build)}
            disabled={choosing !== null}
            style={({ pressed }) => [
              styles.choice,
              {
                backgroundColor: palette.card,
                borderColor: choosing === choice.key ? palette.accent : palette.border,
                opacity: choosing !== null && choosing !== choice.key ? 0.5 : pressed ? 0.8 : 1,
              },
            ]}>
            <View style={styles.choiceBody}>
              <Text style={[styles.choiceTitle, { color: palette.text }]}>
                {choice.title}
              </Text>
              <Text style={[styles.choiceBlurb, { color: palette.textMuted }]}>
                {choice.blurb}
              </Text>
            </View>
            <Ionicons
              name={choosing === choice.key ? 'ellipsis-horizontal' : 'chevron-forward'}
              size={18}
              color={palette.accent}
            />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  hero: { gap: spacing.sm, alignItems: 'flex-start' },
  mark: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8, lineHeight: 34 },
  subtitle: { fontSize: 15, lineHeight: 21 },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  privacyText: { flex: 1, fontSize: 13, lineHeight: 19 },
  choices: { gap: spacing.sm },
  choicesTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  choicesHint: { fontSize: 13.5, lineHeight: 19, marginBottom: spacing.xs },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  choiceBody: { flex: 1, gap: 3 },
  choiceTitle: { fontSize: 16, fontWeight: '700' },
  choiceBlurb: { fontSize: 13, lineHeight: 18 },
});
