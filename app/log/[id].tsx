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
import { FormRenderer } from '@/components/FormRenderer';
import { fieldsForEntry, type EntryValues, type FieldValue } from '@/forms';
import { useForm } from '@/hooks/useForm';
import { formatDateTime, relativeFromNow } from '@/lib/dates';
import { deleteEntry, getEntry, updateEntry, type Entry } from '@/store';
import { radius, spacing, usePalette } from '@/theme';

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { form } = useForm();

  const [entry, setEntry] = useState<Entry | null>(null);
  const [values, setValues] = useState<EntryValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const found = id ? await getEntry(db, id, form.fields) : null;
      if (!active) return;
      setEntry(found);
      setValues(found ? { ...found.values } : null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [db, id, form.fields]);

  useEffect(() => {
    if (entry) {
      navigation.setOptions({ title: formatDateTime(entry.createdAt) });
    }
  }, [entry, navigation]);

  const onChange = useCallback((fieldId: string, value: FieldValue) => {
    setValues((current) => (current ? { ...current, [fieldId]: value } : current));
  }, []);

  const dirty = useMemo(() => {
    if (!entry || !values) return false;
    return JSON.stringify(entry.values) !== JSON.stringify(values);
  }, [entry, values]);

  // Archived fields show up here only when this entry has an answer for one,
  // so an old answer stays visible and clearable rather than silently stored.
  const fields = useMemo(
    () => (values ? fieldsForEntry(form.fields, values) : []),
    [form.fields, values]
  );

  const onSave = useCallback(async () => {
    if (!entry || !values || !dirty || saving) return;
    setSaving(true);
    try {
      await updateEntry(db, entry, values);
      const refreshed = await getEntry(db, entry.id, form.fields);
      setEntry(refreshed);
      setValues(refreshed ? { ...refreshed.values } : values);
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {}
        );
      }
    } finally {
      setSaving(false);
    }
  }, [db, entry, values, dirty, saving, form.fields]);

  const onDelete = useCallback(() => {
    if (!entry) return;
    Alert.alert('Delete this entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(db, entry.id);
          router.back();
        },
      },
    ]);
  }, [db, entry]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  if (!entry || !values) {
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
            {formatDateTime(entry.createdAt)}
          </Text>
          <Text style={[styles.metaSecondary, { color: palette.textMuted }]}>
            Logged {relativeFromNow(entry.createdAt)}
            {entry.updatedAt !== entry.createdAt
              ? ` · edited ${relativeFromNow(entry.updatedAt)}`
              : ''}
          </Text>
        </View>

        <FormRenderer fields={fields} values={values} onChange={onChange} />

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
