import { StyleSheet, Text, View } from 'react-native';
import {
  suggestionsFor,
  type EntryValues,
  type FieldValue,
  type FormField,
} from '../../forms';
import { formatDateTime } from '../../lib/dates';
import { spacing, usePalette } from '../../theme';
import { Chip } from '../Chip';
import { MomentInput } from './MomentInput';
import { NotesInput } from './NotesInput';
import { SliderInput } from './SliderInput';
import { WordsInput } from './WordsInput';
import { YesNoInput } from './YesNoInput';

type Props = {
  field: FormField;
  /** The whole entry, because word suggestions can follow another field. */
  values: EntryValues;
  /** The whole form, for the same reason. */
  fields: readonly FormField[];
  onChange: (fieldId: string, value: FieldValue) => void;
  tint: string;
  /** Most recent answer from an earlier entry, offered as a one-tap reuse. */
  previousValue?: FieldValue;
};

/** Renders the control for one field. Labels and cards are the renderer's job. */
export function FieldInput({
  field,
  values,
  fields,
  onChange,
  tint,
  previousValue,
}: Props) {
  const palette = usePalette();
  const value = values[field.id] ?? null;
  const set = (next: FieldValue) => onChange(field.id, next);

  switch (field.kind) {
    case 'slider':
      return (
        <SliderInput
          field={field}
          value={typeof value === 'number' ? value : null}
          onChange={set}
          tint={tint}
        />
      );

    case 'words':
      return (
        <WordsInput
          field={field}
          suggestions={suggestionsFor(field, values)}
          value={typeof value === 'string' ? value : null}
          onChange={set}
          tint={tint}
        />
      );

    case 'text':
      return (
        <View style={styles.stack}>
          <NotesInput
            value={typeof value === 'string' ? value : null}
            onChange={set}
            placeholder={field.placeholder}
            lines={field.lines}
          />
          {!!field.footnote && (
            <Text style={[styles.footnote, { color: palette.textFaint }]}>
              {field.footnote}
            </Text>
          )}
        </View>
      );

    case 'datetime': {
      const current = typeof value === 'string' ? value : null;
      const suggestion =
        field.suggestPrevious && current === null && typeof previousValue === 'string'
          ? previousValue
          : null;
      return (
        <View style={styles.stack}>
          <MomentInput value={current} onChange={set} emptyLabel={field.emptyLabel} />
          {suggestion && (
            <View style={styles.hintRow}>
              <Text style={[styles.hintText, { color: palette.textFaint }]}>
                {`Previously ${formatDateTime(suggestion)}`}
              </Text>
              <Chip size="sm" label="Reuse" onPress={() => set(suggestion)} />
            </View>
          )}
        </View>
      );
    }

    case 'yesno':
      return (
        <YesNoInput
          field={field}
          value={typeof value === 'boolean' ? value : null}
          onChange={set}
        />
      );
  }
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  footnote: { fontSize: 12, lineHeight: 17 },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  hintText: { fontSize: 12.5, flex: 1 },
});
