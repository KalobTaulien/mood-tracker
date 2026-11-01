#!/usr/bin/env node
/**
 * Checks the storage layer against an in-memory stand-in for SQLiteDatabase.
 *
 *   npm run check:store
 *
 * The migration from the old fixed-column `logs` table is the riskiest code
 * in the project: it runs once, unattended, on the first launch after an
 * upgrade, against a journal someone may have kept for months. These checks
 * exist so that path is not shipped on the strength of "it compiled".
 *
 * There is no test runner here on purpose. The storage layer is plain
 * TypeScript with no React and no native modules, so it can be compiled with
 * the project's own tsc and exercised under Node — which keeps the dependency
 * list short for an app whose whole point is that it does very little.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), 'moodtracker-check-'));

function build() {
  // backup.ts imports these at module scope. Only its parse/import halves are
  // exercised here, so a stub is enough to let the module load under Node.
  for (const [name, body] of [
    ['expo-file-system', 'module.exports = { File: class {}, Paths: { cache: null } };'],
    ['expo-sharing', 'module.exports = { isAvailableAsync: async () => false, shareAsync: async () => {} };'],
  ]) {
    const dir = join(out, 'node_modules', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.js'), body);
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, main: 'index.js' }));
  }

  execFileSync(
    'npx',
    [
      'tsc',
      'src/store/backup.ts', 'src/store/legacy.ts', 'src/store/entries.ts',
      'src/store/form.ts', 'src/forms/index.ts',
      '--ignoreConfig',
      '--outDir', out, '--rootDir', 'src',
      '--module', 'commonjs', '--target', 'es2020', '--moduleResolution', 'node',
      '--esModuleInterop', '--skipLibCheck', '--strict',
      '--ignoreDeprecations', '6.0',
    ],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
  );
}

const load = (p) => import(pathToFileURL(join(out, p)).href);

/* ---------------------------------------------------------------- asserts */

let pass = 0;
const failures = [];

function ok(name, cond) {
  if (cond) pass += 1;
  else failures.push(name);
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}`);
}

function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}\n         actual   ${a}\n         expected ${e}`);
  }
}

async function throws(name, fn, pattern) {
  try {
    await fn();
    failures.push(name);
    console.log(`  FAIL ${name} — did not throw`);
  } catch (error) {
    ok(name, pattern.test(error.message));
  }
}

/** Key-order-insensitive deep compare. */
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  }
  return v;
}

/* ------------------------------------------------- fake SQLiteDatabase ---*/

/**
 * Implements only the handful of methods the store calls. `logRows` is the
 * contents of a legacy `logs` table, or null for a device that never had one.
 */
function makeDb(logRows) {
  const table = new Map();
  const key = (c, i) => `${c} ${i}`;
  return {
    rows: table,
    async execAsync() {},
    async withTransactionAsync(fn) {
      await fn();
    },
    async runAsync(sql, params) {
      if (/^INSERT INTO docs/i.test(sql)) {
        const [collection, id, created_at, updated_at, json] = params;
        table.set(key(collection, id), { collection, id, created_at, updated_at, json });
      } else if (/^INSERT INTO settings/i.test(sql)) {
        table.set(key('__settings', params[0]), { value: params[1] });
      } else if (/^DELETE FROM docs WHERE collection = \? AND id = \?/i.test(sql)) {
        table.delete(key(params[0], params[1]));
      } else if (/^DELETE FROM docs WHERE collection = \?/i.test(sql)) {
        for (const k of [...table.keys()]) {
          if (k.startsWith(`${params[0]} `)) table.delete(k);
        }
      } else {
        throw new Error(`unhandled runAsync: ${sql}`);
      }
      return { changes: 1 };
    },
    async getFirstAsync(sql, params) {
      if (/FROM sqlite_master/i.test(sql)) return logRows ? { name: 'logs' } : null;
      if (/FROM settings WHERE key/i.test(sql)) {
        return table.get(key('__settings', params[0])) ?? null;
      }
      if (/SELECT id, created_at, updated_at, json FROM docs/i.test(sql)) {
        return table.get(key(params[0], params[1])) ?? null;
      }
      if (/COUNT\(\*\)/i.test(sql)) {
        let count = 0;
        for (const r of table.values()) if (r.collection === params[0]) count += 1;
        return { count };
      }
      throw new Error(`unhandled getFirstAsync: ${sql}`);
    },
    async getAllAsync(sql, params) {
      if (/SELECT \* FROM logs/i.test(sql)) return logRows ?? [];
      if (/FROM docs WHERE collection = \?/i.test(sql)) {
        let rows = [...table.values()].filter((r) => r.collection === params[0]);
        if (/created_at >= \?/.test(sql)) rows = rows.filter((r) => r.created_at >= params[1]);
        const asc = /ORDER BY created_at ASC/.test(sql);
        rows.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0) * (asc ? 1 : -1));
        if (/LIMIT \?/.test(sql)) rows = rows.slice(0, params[params.length - 1]);
        return rows;
      }
      throw new Error(`unhandled getAllAsync: ${sql}`);
    },
  };
}

/* ------------------------------------------------------------------ run --*/

async function main() {
  console.log('compiling the storage layer...');
  build();

  const forms = await load('forms/index.js');
  const legacy = await load('store/legacy.js');
  const entries = await load('store/entries.js');
  const form = await load('store/form.js');
  const backup = await load('store/backup.js');

  console.log('\nstarter form');
  const starter = forms.starterForm();
  eq('has 15 fields', starter.fields.length, 15);
  ok(
    'normalize does not change it',
    JSON.stringify(canon(forms.normalizeForm(starter))) === JSON.stringify(canon(starter))
  );
  const once = forms.normalizeForm(starter);
  ok(
    'normalize is idempotent, so saving does not churn the document',
    JSON.stringify(once) === JSON.stringify(forms.normalizeForm(once))
  );
  eq(
    'cards match the pre-builder layout',
    forms.groupFields(starter.fields).map((g) => g.title),
    ['Mood', 'Fatigue', 'Loneliness', 'Movement', 'Thoughts of self-harm',
      'Vegetables', 'Junk food', 'Processed sugar']
  );

  console.log('\nvalue coercion');
  const slider = starter.fields.find((f) => f.id === 'mood_score');
  eq('clamps above max', forms.coerceValue(slider, 99), 10);
  eq('clamps below min', forms.coerceValue(slider, -5), 0);
  eq('rejects junk', forms.coerceValue(slider, 'nope'), null);
  const yesno = starter.fields.find((f) => f.id === 'exercised');
  eq('legacy 1 becomes true', forms.coerceValue(yesno, 1), true);
  eq('legacy 0 becomes false', forms.coerceValue(yesno, 0), false);
  const fatigue = starter.fields.find((f) => f.id === 'fatigue_score');
  eq('low-is-good scale inverts', forms.sliderGoodness(fatigue, 10), 0);

  console.log('\nhostile input');
  eq('garbage form becomes empty', forms.normalizeForm({ fields: 'nope' }).fields.length, 0);
  eq('unknown kinds dropped', forms.normalizeForm({ fields: [{ id: 'a', kind: 'wat' }] }).fields.length, 0);
  const repaired = forms.normalizeForm({ fields: [{ id: 'a', kind: 'slider', min: 10, max: 2 }] }).fields[0];
  eq('inverted range repaired', [repaired.min, repaired.max], [0, 10]);

  console.log('\nlegacy migration');
  const logRows = [
    { id: 1, created_at: '2026-10-01T10:00:00.000Z', updated_at: '2026-10-01T10:00:00.000Z',
      mood_score: 7, mood_word: 'Good', exercised: 1, fatigue_score: 3,
      lonely_at: '2026-09-30T20:00:00.000Z', self_harm_thoughts: null, junk_food_note: '  chips  ' },
    { id: 2, created_at: '2026-10-02T10:00:00.000Z', updated_at: '2026-10-02T11:00:00.000Z',
      mood_score: 2, mood_word: null, exercised: 0 },
    // A row written before the newest columns existed.
    { id: 3, created_at: '2026-10-03T10:00:00.000Z', updated_at: '2026-10-03T10:00:00.000Z', mood_score: 5 },
  ];
  const db = makeDb(logRows);
  const result = await legacy.migrateLegacyLogs(db);
  eq('all rows migrated', [result.found, result.migrated, result.complete], [3, 3, true]);

  const loaded = await form.loadForm(db);
  eq('starter form seeded', loaded.fields.length, 15);
  const all = await entries.listEntries(db, loaded.fields);
  eq('ids are deterministic', all.map((e) => e.id), ['legacy-3', 'legacy-2', 'legacy-1']);
  eq('timestamps preserved', all[1].updatedAt, '2026-10-02T11:00:00.000Z');
  eq('row maps to values', all[2].values, {
    mood_score: 7, mood_word: 'Good', fatigue_score: 3,
    lonely_at: '2026-09-30T20:00:00.000Z', exercised: true, junk_food_note: 'chips',
  });
  eq('nulls are not stored', 'self_harm_thoughts' in all[2].values, false);

  const again = await legacy.migrateLegacyLogs(db);
  eq('re-running does not duplicate', [again.migrated, (await entries.listEntries(db, loaded.fields)).length], [3, 3]);

  console.log('\nentries');
  const id = await entries.createEntry(db, { mood_score: 8, mood_word: ' Bright ', bogus: 'x' }, '2026-10-04T09:00:00.000Z');
  const fetched = await entries.getEntry(db, id, loaded.fields);
  eq('trimmed and pruned on save', fetched.values, { mood_score: 8, mood_word: 'Bright' });
  await entries.updateEntry(db, fetched, { mood_score: 4 });
  eq('createdAt survives an update', (await entries.getEntry(db, id, loaded.fields)).createdAt, '2026-10-04T09:00:00.000Z');

  await entries.createEntry(db, { lonely_at: '2026-05-01T00:00:00.000Z' }, '2026-10-05T09:00:00.000Z');
  eq(
    'reuse hint takes the latest moment, not the newest entry',
    (await entries.latestValues(db, loaded.fields, ['lonely_at'])).lonely_at,
    '2026-09-30T20:00:00.000Z'
  );

  await entries.eraseFieldValues(db, 'mood_score');
  const after = await entries.listEntries(db, loaded.fields);
  eq('erasing a field clears only that field', after.some((e) => 'mood_score' in e.values), false);
  eq('other answers survive', after.find((e) => e.id === 'legacy-1').values.mood_word, 'Good');

  db.rows.set('entry corrupt', {
    collection: 'entry', id: 'corrupt', created_at: '2026-10-06T00:00:00.000Z',
    updated_at: '2026-10-06T00:00:00.000Z', json: '{not json',
  });
  const survived = await entries.listEntries(db, loaded.fields);
  eq('unreadable JSON is skipped, not fatal', survived.some((e) => e.id === 'corrupt'), false);
  ok('good rows still returned', survived.length >= 4);

  console.log('\nfresh install');
  const clean = makeDb(null);
  const none = await legacy.migrateLegacyLogs(clean);
  eq('nothing to migrate', [none.found, none.complete], [0, true]);
  eq('no form seeded', (await form.loadForm(clean)).fields.length, 0);

  console.log('\nbackup');
  const source = makeDb(logRows);
  await legacy.migrateLegacyLogs(source);
  const built = await backup.buildBackup(source);
  eq('entries exported oldest first', built.entries[0].id, 'legacy-1');
  const parsed = backup.parseBackup(JSON.stringify(built, null, 2));
  eq('round-trips through JSON', parsed.entries.length, 3);
  eq('values survive', parsed.entries[0].values.mood_word, 'Good');

  await throws('rejects non-JSON', () => backup.parseBackup('{nope'), /not valid JSON/);
  await throws('rejects another app', () => backup.parseBackup('{"app":"other"}'), /not exported by Mood Tracker/);
  await throws(
    'rejects a newer format',
    () => backup.parseBackup('{"app":"mood-tracker","formatVersion":99}'),
    /newer version/
  );

  const target = makeDb(null);
  await form.saveForm(target, forms.blankForm());
  await entries.createEntry(target, {}, '2026-01-01T00:00:00.000Z');
  await backup.importBackup(target, parsed, 'replace');
  eq('restore replaces everything', await entries.countEntries(target), 3);

  const merged = await backup.importBackup(target, parsed, 'merge');
  eq('merge skips entries already present', [merged.entriesAdded, merged.entriesSkipped], [0, 3]);

  const other = makeDb(null);
  await form.saveForm(other, forms.blankForm());
  const fresh = await backup.importBackup(other, parsed, 'merge');
  eq('merge brings in missing fields', fresh.fieldsAdded, 15);
  const otherForm = await form.loadForm(other);
  ok('imported fields arrive hidden', otherForm.fields.every((f) => f.archived));
  eq(
    'so imported answers stay readable',
    (await entries.listEntries(other, otherForm.fields)).find((e) => e.id === 'legacy-1').values.mood_word,
    'Good'
  );

  const hostile = backup.parseBackup(JSON.stringify({
    app: 'mood-tracker', formatVersion: 1,
    form: { fields: [{ id: 'm', kind: 'slider', label: 'M', min: 0, max: 10 }] },
    entries: [
      { id: 'a', createdAt: '2026-10-01T00:00:00.000Z', values: { m: 9999 } },
      { createdAt: '2026-10-03T00:00:00.000Z', values: { m: 5 } },
    ],
  }));
  eq('entries without an id are dropped', hostile.entries.map((e) => e.id), ['a']);
  eq('out-of-range values clamped', hostile.entries[0].values.m, 10);

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log(failures.map((f) => `  - ${f}`).join('\n'));
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  console.error(error.stdout?.toString() ?? error);
  process.exitCode = 1;
} finally {
  rmSync(out, { recursive: true, force: true });
}
