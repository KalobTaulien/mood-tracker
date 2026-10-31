import { Ionicons } from '@expo/vector-icons';
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
import { Chip } from '@/components/Chip';
import { FormRenderer } from '@/components/FormRenderer';
import {
  NumberSetting,
  SegmentedSetting,
  TextSetting,
  ToggleSetting,
} from '@/components/builder/Settings';
import { WordListEditor } from '@/components/builder/WordListEditor';
import {
  FIELD_KINDS,
  KIND_LABELS,
  newField,
  type EntryValues,
  type FieldKind,
  type FieldValue,
  type FormField,
} from '@/forms';
import { useForm } from '@/hooks/useForm';
import { countFieldAnswers, eraseFieldValues } from '@/store';
import { radius, spacing, usePalette } from '@/theme';

/** Common scales, offered so the usual case is one tap rather than two steppers. */
const SLIDER_PRESETS = [
  { label: '0–5', min: 0, max: 5 },
  { label: '0–10', min: 0, max: 10 },
  { label: '1–10', min: 1, max: 10 },
  { label: '0–100', min: 0, max: 100 },
] as const;

function isFieldKind(value: unknown): value is FieldKind {
  return typeof value === 'string' && (FIELD_KINDS as readonly string[]).includes(value);
}

/**
 * Resolves which field is being edited, then hands a seed to the editor.
 *
 * The editor keeps the field in local state so typing is not lost on every
 * keystroke-triggered re-render, and that state is seeded exactly once — hence
 * the `key`. Remounting on a different field is what swaps the seed, rather
 * than an effect that would have to guess when not to overwrite the draft.
 */
export default function FieldEditorScreen() {
  const { fieldId, kind } = useLocalSearchParams<{ fieldId: string; kind?: string }>();
  const palette = usePalette();
  const { form, configured } = useForm();

  const isNew = fieldId === 'new';
  const newKind = isFieldKind(kind) ? kind : 'slider';
  const existing = isNew
    ? null
    : form.fields.find((item) => item.id === fieldId) ?? null;

  // The form document may still be loading on a cold start into this route.
  if (configured === null) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (!isNew && !existing) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg }]}>
        <Ionicons name="help-circle-outline" size={34} color={palette.textFaint} />
        <Text style={[styles.missing, { color: palette.text }]}>Field not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.link, { color: palette.accent }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FieldEditor
      key={isNew ? `new:${newKind}` : fieldId}
      seed={existing}
      newKind={newKind}
      isNew={isNew}
    />
  );
}

function FieldEditor({
  seed,
  newKind,
  isNew,
}: {
  seed: FormField | null;
  newKind: FieldKind;
  isNew: boolean;
}) {
  const db = useSQLiteContext();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { form, save } = useForm();

  const existing = seed;
  const [draft, setDraft] = useState<FormField>(() =>
    seed ? { ...seed } : newField(newKind)
  );
  const [answerCount, setAnswerCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<EntryValues>({});

  useEffect(() => {
    navigation.setOptions({
      title: isNew ? `New ${KIND_LABELS[newKind].toLowerCase()}` : 'Edit field',
    });
  }, [navigation, isNew, newKind]);

  useEffect(() => {
    if (isNew || !existing) return;
    // setAnswerCount lands in the promise continuation, not in the effect body.
    countFieldAnswers(db, form.fields, existing.id).then(setAnswerCount);
  }, [db, form.fields, existing, isNew]);

  const patch = useCallback((changes: Partial<FormField>) => {
    // Each kind's extra keys are only ever written by that kind's own controls,
    // so widening through the union here is safe.
    setDraft((current) => ({ ...current, ...changes }) as FormField);
  }, []);

  const dirty = useMemo(
    () => (isNew ? true : JSON.stringify(existing) !== JSON.stringify(draft)),
    [draft, existing, isNew]
  );

  const onSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const fields = isNew
        ? [...form.fields, draft]
        : form.fields.map((item) => (item.id === draft.id ? draft : item));
      await save({ ...form, fields });
      router.back();
    } finally {
      setSaving(false);
    }
  }, [draft, form, isNew, save, saving]);

  const onRemove = useCallback(() => {
    if (isNew) return;
    const answers = answerCount ?? 0;

    const archive = async () => {
      await save({
        ...form,
        fields: form.fields.map((item) =>
          item.id === draft.id ? { ...item, archived: true } : item
        ),
      });
      router.back();
    };

    const erase = async () => {
      await eraseFieldValues(db, draft.id);
      await save({ ...form, fields: form.fields.filter((item) => item.id !== draft.id) });
      router.back();
    };

    Alert.alert(
      `Remove "${draft.label}"?`,
      answers > 0
        ? `${answers} ${answers === 1 ? 'entry has' : 'entries have'} an answer for this field.\n\n` +
            'Hiding it keeps those answers readable in History. Erasing deletes them permanently.'
        : 'Nothing has been recorded against this field yet.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Hide from new check-ins', onPress: archive },
        {
          text: answers > 0 ? 'Erase answers too' : 'Delete',
          style: 'destructive',
          onPress: () =>
            answers === 0
              ? erase()
              : Alert.alert(
                  'Erase permanently?',
                  `This deletes ${answers} ${answers === 1 ? 'answer' : 'answers'} and cannot be undone.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Erase', style: 'destructive', onPress: erase },
                  ]
                ),
        },
      ]
    );
  }, [answerCount, db, draft, form, isNew, save]);

  const onRestore = useCallback(async () => {
    await save({
      ...form,
      fields: form.fields.map((item) =>
        item.id === draft.id ? { ...item, archived: false } : item
      ),
    });
    router.back();
  }, [draft, form, save]);

  /** Section names already in use, offered as one-tap choices. */
  const sections = useMemo(() => {
    const names = new Set<string>();
    for (const field of form.fields) if (field.group) names.add(field.group);
    return [...names];
  }, [form.fields]);

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
        <Card title="Basics">
          <TextSetting
            label="Label"
            hint="What the question is called, on the form and in your history."
            value={draft.label}
            onChange={(label) => patch({ label: label ?? '' })}
            placeholder="Mood"
          />
          <TextSetting
            label="Description"
            hint="A line of explanation under the label."
            value={draft.help}
            onChange={(help) => patch({ help })}
            placeholder="0 is the worst you have felt, 10 the best."
            multiline
            optional
          />
          <TextSetting
            label="Section"
            hint="Fields sharing a section appear together in one card. Leave blank to give this field a card of its own."
            value={draft.group}
            onChange={(group) => patch({ group })}
            placeholder="Mood"
            optional
          />
          {sections.length > 0 && (
            <View style={styles.sectionChips}>
              {sections.map((name) => (
                <Chip
                  key={name}
                  size="sm"
                  label={name}
                  selected={draft.group === name}
                  onPress={() => patch({ group: draft.group === name ? null : name })}
                />
              ))}
            </View>
          )}
        </Card>

        {draft.kind === 'slider' && (
          <Card title="Scale">
            <View style={styles.sectionChips}>
              {SLIDER_PRESETS.map((preset) => (
                <Chip
                  key={preset.label}
                  size="sm"
                  label={preset.label}
                  selected={draft.min === preset.min && draft.max === preset.max}
                  onPress={() => patch({ min: preset.min, max: preset.max })}
                />
              ))}
            </View>
            <NumberSetting
              label="Lowest value"
              value={draft.min}
              onChange={(min) => patch({ min: Math.min(min, draft.max - 1) })}
              min={-100}
              max={draft.max - 1}
            />
            <NumberSetting
              label="Highest value"
              value={draft.max}
              onChange={(max) => patch({ max: Math.max(max, draft.min + 1) })}
              min={draft.min + 1}
              max={100}
            />
            <TextSetting
              label="Label for the low end"
              value={draft.minLabel}
              onChange={(minLabel) => patch({ minLabel: minLabel ?? '' })}
              placeholder="Worst"
            />
            <TextSetting
              label="Label for the high end"
              value={draft.maxLabel}
              onChange={(maxLabel) => patch({ maxLabel: maxLabel ?? '' })}
              placeholder="Best"
            />
            <SegmentedSetting
              label="Which end is good news?"
              hint="Sets the colour and which direction counts as improving. Fatigue, for example, is better when it is low."
              value={draft.goodEnd}
              options={[
                { value: 'high' as const, label: 'Higher is better' },
                { value: 'low' as const, label: 'Lower is better' },
              ]}
              onChange={(goodEnd) => patch({ goodEnd })}
            />
            <ToggleSetting
              label="Show on the Trends chart"
              hint="Plots this field as a line over time."
              value={draft.chart}
              onChange={(chart) => patch({ chart })}
            />
          </Card>
        )}

        {draft.kind === 'words' && (
          <Card title="Words">
            {draft.linkedSliderId ? (
              <Text style={[styles.note, { color: palette.textMuted }]}>
                This field&apos;s suggestions change with its slider — a 2 offers
                different words than an 8. That pairing came with the starter form and
                is kept as-is; you can still add your own words below, and they show
                whenever the slider has no value.
              </Text>
            ) : null}
            <WordListEditor
              words={draft.options}
              onChange={(options) => patch({ options })}
            />
            <ToggleSetting
              label="Allow writing your own"
              hint="Adds a text box under the chips so you are never stuck with the list."
              value={draft.allowCustom}
              onChange={(allowCustom) => patch({ allowCustom })}
            />
          </Card>
        )}

        {draft.kind === 'text' && (
          <Card title="Writing space">
            <TextSetting
              label="Placeholder"
              hint="Faint prompt shown in the empty box."
              value={draft.placeholder}
              onChange={(placeholder) => patch({ placeholder: placeholder ?? '' })}
              placeholder="What came up, and what it felt like"
            />
            <SegmentedSetting
              label="Height"
              value={draft.lines}
              options={[
                { value: 1, label: 'One line' },
                { value: 3, label: 'A few lines' },
                { value: 6, label: 'Long' },
              ]}
              onChange={(lines) => patch({ lines })}
            />
            <TextSetting
              label="Small print"
              hint="Shown under the box. Useful for a reminder or a helpline."
              value={draft.footnote}
              onChange={(footnote) => patch({ footnote })}
              multiline
              optional
            />
          </Card>
        )}

        {draft.kind === 'datetime' && (
          <Card title="Picker">
            <TextSetting
              label="Prompt on the empty button"
              value={draft.emptyLabel}
              onChange={(emptyLabel) => patch({ emptyLabel: emptyLabel ?? '' })}
              placeholder="Pick when you last felt lonely"
            />
            <ToggleSetting
              label="Offer your last answer"
              hint="Shows the most recent moment you recorded, with a one-tap Reuse button."
              value={draft.suggestPrevious}
              onChange={(suggestPrevious) => patch({ suggestPrevious })}
            />
          </Card>
        )}

        {draft.kind === 'yesno' && (
          <Card title="Choices">
            <TextSetting
              label="Yes looks like"
              value={draft.yesLabel}
              onChange={(yesLabel) => patch({ yesLabel: yesLabel ?? '' })}
              placeholder="Yes"
            />
            <TextSetting
              label="No looks like"
              value={draft.noLabel}
              onChange={(noLabel) => patch({ noLabel: noLabel ?? '' })}
              placeholder="No"
            />
          </Card>
        )}

        <View style={styles.previewBlock}>
          <Text style={[styles.previewTitle, { color: palette.textMuted }]}>Preview</Text>
          <FormRenderer
            fields={[draft]}
            values={preview}
            onChange={(id, value: FieldValue) =>
              setPreview((current) => ({ ...current, [id]: value }))
            }
          />
        </View>

        {!isNew && (
          <Pressable
            onPress={draft.archived ? onRestore : onRemove}
            style={({ pressed }) => [
              styles.destructive,
              {
                backgroundColor: draft.archived ? palette.accentSoft : palette.dangerSoft,
                borderColor: draft.archived ? palette.accent : palette.danger,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <Ionicons
              name={draft.archived ? 'refresh' : 'trash-outline'}
              size={17}
              color={draft.archived ? palette.accent : palette.danger}
            />
            <Text
              style={[
                styles.destructiveText,
                { color: draft.archived ? palette.accent : palette.danger },
              ]}>
              {draft.archived ? 'Restore to the form' : 'Remove this field'}
            </Text>
          </Pressable>
        )}
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
            <Text style={styles.saveText}>
              {saving ? 'Saving…' : isNew ? 'Add to form' : 'Save changes'}
            </Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  missing: { fontSize: 17, fontWeight: '600' },
  link: { fontSize: 15, fontWeight: '600' },
  content: { padding: spacing.lg, gap: spacing.lg },
  sectionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  note: { fontSize: 12.5, lineHeight: 18 },
  previewBlock: { gap: spacing.sm },
  previewTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: spacing.xs,
  },
  destructive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  destructiveText: { fontSize: 15, fontWeight: '600' },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  saveButton: { borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center' },
  saveText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
