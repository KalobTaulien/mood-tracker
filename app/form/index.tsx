import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import {
  FIELD_KINDS,
  KIND_BLURBS,
  KIND_LABELS,
  moveField,
  type FieldKind,
  type FormField,
} from '@/forms';
import { useForm } from '@/hooks/useForm';
import { radius, spacing, usePalette } from '@/theme';

/** Short summary of a field's configuration, shown under its label. */
function describeField(field: FormField): string {
  const kind = KIND_LABELS[field.kind];
  switch (field.kind) {
    case 'slider':
      return `${kind} · ${field.min}–${field.max} · ${
        field.goodEnd === 'high' ? 'higher is better' : 'lower is better'
      }${field.chart ? ' · charted' : ''}`;
    case 'words': {
      if (field.linkedSliderId) return `${kind} · suggestions follow a slider`;
      const count = field.options.length;
      return `${kind} · ${count} ${count === 1 ? 'word' : 'words'}${
        field.allowCustom ? ' · free text allowed' : ''
      }`;
    }
    case 'text':
      return `${kind} · ${field.lines === 1 ? 'single line' : `${field.lines} lines`}`;
    case 'datetime':
      return field.suggestPrevious ? `${kind} · offers your last answer` : kind;
    case 'yesno':
      return `${kind} · ${field.yesLabel} / ${field.noLabel}`;
  }
}

export default function FormBuilderScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { form, save, reload } = useForm();
  const [picking, setPicking] = useState(false);

  // The editor is a separate screen, so come back to whatever it saved.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const live = useMemo(() => form.fields.filter((field) => !field.archived), [form.fields]);
  const archived = useMemo(
    () => form.fields.filter((field) => field.archived),
    [form.fields]
  );

  /** Reorders within the live list, translating back to full-list indices. */
  const shift = useCallback(
    async (field: FormField, delta: number) => {
      const liveIndex = live.findIndex((item) => item.id === field.id);
      const target = live[liveIndex + delta];
      if (!target) return;

      const from = form.fields.findIndex((item) => item.id === field.id);
      const to = form.fields.findIndex((item) => item.id === target.id);
      await save({ ...form, fields: moveField(form.fields, from, to) });
    },
    [form, live, save]
  );

  const restore = useCallback(
    async (field: FormField) => {
      await save({
        ...form,
        fields: form.fields.map((item) =>
          item.id === field.id ? { ...item, archived: false } : item
        ),
      });
    },
    [form, save]
  );

  const addField = useCallback((kind: FieldKind) => {
    setPicking(false);
    router.navigate(`/form/new?kind=${kind}`);
  }, []);

  return (
    <>
      <ScrollView
        style={{ backgroundColor: palette.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}>
        <Card
          title="Your check-in"
          subtitle="These are the questions the Log tab asks, in order. Every one of them is optional to answer.">
          {live.length === 0 ? (
            <Text style={[styles.empty, { color: palette.textMuted }]}>
              No fields yet. Add your first one below.
            </Text>
          ) : (
            <View style={styles.list}>
              {live.map((field, index) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  isFirst={index === 0}
                  isLast={index === live.length - 1}
                  onPress={() => router.navigate(`/form/${field.id}`)}
                  onUp={() => shift(field, -1)}
                  onDown={() => shift(field, 1)}
                />
              ))}
            </View>
          )}

          <Pressable
            onPress={() => setPicking(true)}
            style={({ pressed }) => [
              styles.addButton,
              {
                borderColor: palette.accent,
                backgroundColor: palette.accentSoft,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <Ionicons name="add" size={18} color={palette.accent} />
            <Text style={[styles.addText, { color: palette.accent }]}>Add a field</Text>
          </Pressable>
        </Card>

        {archived.length > 0 && (
          <Card
            title="Removed fields"
            subtitle="Hidden from new check-ins, but kept so your older entries still read correctly. Open one to restore it or erase its answers for good.">
            <View style={styles.list}>
              {archived.map((field) => (
                <Pressable
                  key={field.id}
                  onPress={() => router.navigate(`/form/${field.id}`)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: palette.cardAlt,
                      borderColor: palette.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}>
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowLabel, { color: palette.textMuted }]}>
                      {field.label}
                    </Text>
                    <Text style={[styles.rowMeta, { color: palette.textFaint }]}>
                      {KIND_LABELS[field.kind]}
                    </Text>
                  </View>
                  <Pressable onPress={() => restore(field)} hitSlop={8} style={styles.restore}>
                    <Text style={[styles.restoreText, { color: palette.accent }]}>
                      Restore
                    </Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </Card>
        )}

        <Text style={[styles.footnote, { color: palette.textFaint }]}>
          Renaming a field updates it everywhere, including entries you have already
          saved. Answers are stored against the field itself, not its name.
        </Text>
      </ScrollView>

      <Modal
        visible={picking}
        transparent
        animationType="slide"
        onRequestClose={() => setPicking(false)}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: palette.overlay }]}
          onPress={() => setPicking(false)}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            },
          ]}>
          <Text style={[styles.sheetTitle, { color: palette.text }]}>
            What kind of field?
          </Text>
          {FIELD_KINDS.map((kind) => (
            <Pressable
              key={kind}
              onPress={() => addField(kind)}
              style={({ pressed }) => [
                styles.kindRow,
                {
                  backgroundColor: palette.cardAlt,
                  borderColor: palette.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}>
              <View style={styles.rowBody}>
                <Text style={[styles.rowLabel, { color: palette.text }]}>
                  {KIND_LABELS[kind]}
                </Text>
                <Text style={[styles.rowMeta, { color: palette.textMuted }]}>
                  {KIND_BLURBS[kind]}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={palette.textFaint} />
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
}

function FieldRow({
  field,
  isFirst,
  isLast,
  onPress,
  onUp,
  onDown,
}: {
  field: FormField;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
  onUp: () => void;
  onDown: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: palette.cardAlt,
          borderColor: palette.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Text style={[styles.rowLabel, { color: palette.text }]} numberOfLines={1}>
            {field.label}
          </Text>
          {!!field.group && (
            <Text style={[styles.sectionTag, { color: palette.accent }]} numberOfLines={1}>
              {field.group}
            </Text>
          )}
        </View>
        <Text style={[styles.rowMeta, { color: palette.textMuted }]} numberOfLines={1}>
          {describeField(field)}
        </Text>
      </View>

      <View style={styles.arrows}>
        <Pressable onPress={onUp} disabled={isFirst} hitSlop={6} style={styles.arrow}>
          <Ionicons
            name="chevron-up"
            size={17}
            color={isFirst ? palette.textFaint : palette.accent}
          />
        </Pressable>
        <Pressable onPress={onDown} disabled={isLast} hitSlop={6} style={styles.arrow}>
          <Ionicons
            name="chevron-down"
            size={17}
            color={isLast ? palette.textFaint : palette.accent}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  list: { gap: spacing.sm },
  empty: { fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  rowLabel: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  sectionTag: { fontSize: 11.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  rowMeta: { fontSize: 12.5 },
  arrows: { flexDirection: 'row', gap: 2 },
  arrow: { paddingHorizontal: 5, paddingVertical: 3 },
  restore: { paddingHorizontal: spacing.xs },
  restoreText: { fontSize: 13.5, fontWeight: '600' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    paddingVertical: 13,
  },
  addText: { fontSize: 15, fontWeight: '600' },
  footnote: { fontSize: 12, lineHeight: 17, paddingHorizontal: spacing.xs },
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', marginBottom: spacing.xs },
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
});
