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
import { FormRenderer } from '@/components/FormRenderer';
import { isEntryEmpty, type EntryValues, type FieldValue } from '@/forms';
import { useForm } from '@/hooks/useForm';
import { relativeFromNow } from '@/lib/dates';
import { createEntry, latestValues, listEntries } from '@/store';
import { radius, spacing, usePalette } from '@/theme';

export default function LogScreen() {
  const db = useSQLiteContext();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { form, visibleFields } = useForm();

  const [values, setValues] = useState<EntryValues>({});
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [lastEntryAt, setLastEntryAt] = useState<string | null>(null);
  const [previousValues, setPreviousValues] = useState<Record<string, FieldValue>>({});

  /** Date fields that offer their last answer as a one-tap reuse. */
  const suggestIds = useMemo(
    () =>
      visibleFields
        .filter((field) => field.kind === 'datetime' && field.suggestPrevious)
        .map((field) => field.id),
    [visibleFields]
  );

  const loadContext = useCallback(async () => {
    const [recent, previous] = await Promise.all([
      listEntries(db, form.fields, { limit: 1 }),
      latestValues(db, form.fields, suggestIds),
    ]);
    setLastEntryAt(recent[0]?.createdAt ?? null);
    setPreviousValues(previous);
  }, [db, form.fields, suggestIds]);

  useFocusEffect(
    useCallback(() => {
      loadContext();
    }, [loadContext])
  );

  const onChange = useCallback((fieldId: string, value: FieldValue) => {
    setSavedId(null);
    setValues((current) => ({ ...current, [fieldId]: value }));
  }, []);

  const empty = isEntryEmpty(values);

  const onSave = useCallback(async () => {
    if (empty || saving) return;
    setSaving(true);
    try {
      const id = await createEntry(db, values);
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {}
        );
      }
      setValues({});
      setSavedId(id);
      await loadContext();
    } finally {
      setSaving(false);
    }
  }, [db, values, empty, saving, loadContext]);

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
              {lastEntryAt
                ? `Last logged ${relativeFromNow(lastEntryAt)}`
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
              <Ionicons name="settings-outline" size={19} color={palette.textMuted} />
            </Pressable>
          </Link>
        </View>

        {savedId !== null && (
          <Pressable
            onPress={() => router.navigate(`/log/${savedId}`)}
            style={[
              styles.savedBanner,
              { backgroundColor: palette.accentSoft, borderColor: palette.accent },
            ]}>
            <Ionicons name="checkmark-circle" size={20} color={palette.accent} />
            <Text style={[styles.savedText, { color: palette.text }]}>
              Saved. Tap to view this entry.
            </Text>
          </Pressable>
        )}

        {visibleFields.length === 0 ? (
          <Card
            title="Your form is empty"
            subtitle="Add the questions you want to answer each time you check in.">
            <Link href="/form" asChild>
              <Pressable
                style={StyleSheet.flatten([
                  styles.primaryButton,
                  { backgroundColor: palette.accent },
                ])}>
                <Text style={styles.primaryButtonText}>Build your form</Text>
              </Pressable>
            </Link>
          </Card>
        ) : (
          <FormRenderer
            fields={visibleFields}
            values={values}
            onChange={onChange}
            previousValues={previousValues}
          />
        )}
      </ScrollView>

      {visibleFields.length > 0 && (
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
              style={[styles.saveText, { color: empty ? palette.textFaint : '#FFFFFF' }]}>
              {saving ? 'Saving…' : empty ? 'Fill in anything to save' : 'Save entry'}
            </Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
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
  primaryButton: { borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  primaryButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
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
