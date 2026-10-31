import { newId } from '../lib/ids';
import { KIND_LABELS, type FieldKind, type FormField } from './types';

/** A new field of `kind`, with defaults the user can edit straight away. */
export function newField(kind: FieldKind): FormField {
  const common = {
    id: newId(),
    label: KIND_LABELS[kind],
    help: null,
    group: null,
    archived: false,
  };

  switch (kind) {
    case 'slider':
      return {
        ...common,
        label: 'New scale',
        kind: 'slider',
        min: 0,
        max: 10,
        minLabel: 'Low',
        maxLabel: 'High',
        goodEnd: 'high',
        chart: true,
      };
    case 'words':
      return {
        ...common,
        label: 'A word for it',
        kind: 'words',
        options: [],
        allowCustom: true,
        linkedSliderId: null,
        optionsByScore: null,
      };
    case 'text':
      return {
        ...common,
        label: 'Notes',
        kind: 'text',
        placeholder: 'Write as much or as little as you like',
        lines: 3,
        footnote: null,
      };
    case 'datetime':
      return {
        ...common,
        label: 'When it last happened',
        kind: 'datetime',
        emptyLabel: 'Pick a date & time',
        suggestPrevious: true,
      };
    case 'yesno':
      return {
        ...common,
        label: 'Did it happen?',
        kind: 'yesno',
        yesLabel: 'Yes',
        noLabel: 'No',
      };
  }
}

/** A copy of `field` under a fresh id, so it can sit alongside the original. */
export function duplicateField(field: FormField): FormField {
  return { ...field, id: newId(), label: `${field.label} copy`, archived: false };
}

/** Moves the field at `from` to `to`, returning a new array. */
export function moveField(
  fields: readonly FormField[],
  from: number,
  to: number
): FormField[] {
  if (from === to || from < 0 || from >= fields.length) return [...fields];
  const next = [...fields];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, moved);
  return next;
}
