/**
 * Document ids for the on-device store.
 *
 * Nothing syncs and nothing is shared, so these need to be unique on one
 * device rather than globally unguessable — which rules out needing a native
 * crypto module. The timestamp prefix keeps ids roughly sortable by creation,
 * which makes a raw backup file readable by eye.
 */

const RANDOM_CHARS = 10;

function randomSuffix(): string {
  let out = '';
  for (let i = 0; i < RANDOM_CHARS; i++) {
    out += Math.floor(Math.random() * 36).toString(36);
  }
  return out;
}

/** e.g. "m3kq8p1f-7d2a9ck0xz" — time-ordered prefix, random tail. */
export function newId(): string {
  return `${Date.now().toString(36)}-${randomSuffix()}`;
}

/** Ids we generate ourselves, plus anything an imported backup might carry. */
export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}
