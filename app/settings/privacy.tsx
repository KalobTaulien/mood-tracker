import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { useForm } from '@/hooks/useForm';
import {
  BackupError,
  countEntries,
  eraseEverything,
  exportBackup,
  importBackup,
  pickBackup,
  type BackupFile,
} from '@/store';
import { radius, spacing, usePalette } from '@/theme';

type Busy = 'export' | 'import' | 'erase' | null;

export default function PrivacyScreen() {
  const db = useSQLiteContext();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { form, reload } = useForm();

  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  const refresh = useCallback(async () => {
    setEntryCount(await countEntries(db));
  }, [db]);

  useEffect(() => {
    // setEntryCount runs after an await inside refresh(), not in this body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const onExport = useCallback(async () => {
    setBusy('export');
    try {
      const result = await exportBackup(db);
      if (!result.shared) {
        Alert.alert(
          'Backup written',
          `${result.fileName} was saved inside the app's own storage, but this device has no share sheet to send it anywhere.`
        );
      }
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Unknown error.');
    } finally {
      setBusy(null);
    }
  }, [db]);

  const runImport = useCallback(
    async (backup: BackupFile, mode: 'replace' | 'merge') => {
      setBusy('import');
      try {
        const result = await importBackup(db, backup, mode);
        await reload();
        await refresh();

        const lines = [
          `${result.entriesAdded} ${result.entriesAdded === 1 ? 'entry' : 'entries'} imported.`,
        ];
        if (result.entriesSkipped > 0) {
          lines.push(`${result.entriesSkipped} already existed and were left alone.`);
        }
        if (result.fieldsAdded > 0) {
          lines.push(
            `${result.fieldsAdded} ${result.fieldsAdded === 1 ? 'field was' : 'fields were'} added hidden, so the imported answers stay readable. Restore any of them under Your form.`
          );
        }
        Alert.alert('Import complete', lines.join('\n\n'));
        if (mode === 'replace') router.replace('/');
      } catch (error) {
        Alert.alert('Import failed', error instanceof Error ? error.message : 'Unknown error.');
      } finally {
        setBusy(null);
      }
    },
    [db, refresh, reload]
  );

  const onImport = useCallback(async () => {
    setBusy('import');
    let backup: BackupFile | null = null;
    try {
      backup = await pickBackup();
    } catch (error) {
      Alert.alert(
        "That file won't import",
        error instanceof BackupError ? error.message : 'The file could not be read.'
      );
      setBusy(null);
      return;
    }
    setBusy(null);
    if (!backup) return;

    const exported = backup.exportedAt.slice(0, 10);
    Alert.alert(
      'Import this backup?',
      `${backup.entries.length} ${backup.entries.length === 1 ? 'entry' : 'entries'} and ${backup.form.fields.length} ${backup.form.fields.length === 1 ? 'field' : 'fields'}, exported ${exported}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add missing entries',
          onPress: () => runImport(backup!, 'merge'),
        },
        {
          text: 'Replace everything',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Replace everything?',
              'Your current form and all of your entries on this device will be deleted and replaced by the backup. This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Replace',
                  style: 'destructive',
                  onPress: () => runImport(backup!, 'replace'),
                },
              ]
            ),
        },
      ]
    );
  }, [runImport]);

  const onErase = useCallback(() => {
    Alert.alert(
      'Erase everything?',
      `This deletes your form and all ${entryCount ?? 0} ${entryCount === 1 ? 'entry' : 'entries'} from this device. There is no backup unless you exported one. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase everything',
          style: 'destructive',
          onPress: async () => {
            setBusy('erase');
            try {
              await eraseEverything(db);
              await reload();
              router.replace('/');
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }, [db, entryCount, reload]);

  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xl },
      ]}>
      <Card title="Nothing leaves this device">
        <Point text="Your entries and your form are stored in a database file inside this app, on this phone." />
        <Point text="The app has no account, no login, and no server to sync with. Nothing you write is ever uploaded." />
        <Point text="Reminders are scheduled by the phone itself, so they work with no network at all." />
        <Point text="Deleting the app deletes the journal with it — which is why a backup is worth keeping." />
      </Card>

      <Card
        title="Back up your journal"
        subtitle="Writes a readable JSON file and hands it to the share sheet. Where it goes from there is entirely your choice — the app never finds out.">
        <Text style={[styles.stat, { color: palette.textMuted }]}>
          {entryCount === null
            ? 'Counting…'
            : `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'} · ${form.fields.length} ${form.fields.length === 1 ? 'field' : 'fields'}`}
        </Text>
        <Button
          label="Export a backup"
          icon="share-outline"
          loading={busy === 'export'}
          disabled={busy !== null}
          onPress={onExport}
        />
      </Card>

      <Card
        title="Restore from a backup"
        subtitle="Pick a file you exported earlier. You can replace everything, or just pull in entries this device does not have yet.">
        <Button
          label="Import a backup"
          icon="download-outline"
          loading={busy === 'import'}
          disabled={busy !== null}
          onPress={onImport}
        />
      </Card>

      <Card
        title="Erase everything"
        subtitle="Removes your form and every entry from this device, and starts you over from a blank slate.">
        <Button
          label="Erase everything"
          icon="trash-outline"
          destructive
          loading={busy === 'erase'}
          disabled={busy !== null}
          onPress={onErase}
        />
      </Card>
    </ScrollView>
  );
}

function Point({ text }: { text: string }) {
  const palette = usePalette();
  return (
    <View style={styles.point}>
      <Ionicons name="checkmark-circle" size={17} color={palette.success} />
      <Text style={[styles.pointText, { color: palette.textMuted }]}>{text}</Text>
    </View>
  );
}

function Button({
  label,
  icon,
  onPress,
  loading = false,
  disabled = false,
  destructive = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const palette = usePalette();
  const tint = destructive ? palette.danger : palette.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: destructive ? palette.dangerSoft : palette.accentSoft,
          borderColor: tint,
          opacity: disabled && !loading ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}>
      {loading ? (
        <ActivityIndicator color={tint} size="small" />
      ) : (
        <Ionicons name={icon} size={17} color={tint} />
      )}
      <Text style={[styles.buttonText, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg },
  point: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  pointText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  stat: { fontSize: 13 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 13,
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
});
