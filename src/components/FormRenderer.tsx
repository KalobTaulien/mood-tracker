import { StyleSheet, Text, View } from 'react-native';
import {
  groupFields,
  type EntryValues,
  type FieldValue,
  type FormField,
} from '@/forms';
import { Card } from './Card';
import { FieldInput } from './fields/FieldInput';
import { fieldTint } from './fields/tint';
import { spacing, useIsDark, usePalette } from '@/theme';

type Props = {
  /** Visible fields, in order. Archived ones should be filtered out already. */
  fields: FormField[];
  values: EntryValues;
  onChange: (fieldId: string, value: FieldValue) => void;
  /** Latest earlier answer per field id, for the "reuse" hints. */
  previousValues?: Record<string, FieldValue>;
};

/**
 * Renders the whole user-defined form.
 *
 * Fields sharing a `group` collapse into one card: the first field supplies
 * the card's heading and explanation, and every field after it gets its own
 * label above its control. That is what keeps a two-part section like Mood
 * (a slider plus a word) reading as one thing.
 */
export function FormRenderer({ fields, values, onChange, previousValues }: Props) {
  const palette = usePalette();
  const isDark = useIsDark();
  const groups = groupFields(fields);

  return (
    <>
      {groups.map((group) => (
        <Card key={group.key} title={group.title} subtitle={group.subtitle ?? undefined}>
          {group.fields.map((field, index) => (
            <View key={field.id} style={styles.field}>
              {index > 0 && (
                <View style={styles.labelBlock}>
                  <Text style={[styles.label, { color: palette.text }]}>{field.label}</Text>
                  {!!field.help && (
                    <Text style={[styles.help, { color: palette.textMuted }]}>
                      {field.help}
                    </Text>
                  )}
                </View>
              )}
              <FieldInput
                field={field}
                values={values}
                fields={fields}
                onChange={onChange}
                tint={fieldTint(field, values, fields, palette, isDark)}
                previousValue={previousValues?.[field.id]}
              />
            </View>
          ))}
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  labelBlock: { gap: 1 },
  label: { fontSize: 14, fontWeight: '600' },
  help: { fontSize: 12.5, lineHeight: 17 },
});
