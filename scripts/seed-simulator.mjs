#!/usr/bin/env node
/**
 * Fills a Simulator install with plausible history, for looking at History and
 * Trends with something in them.
 *
 *   npm run seed            # 60 days into the booted simulator
 *   npm run seed -- --days 120 --seed 7
 *   npm run seed -- --keep  # add to existing entries instead of replacing
 *
 * This writes straight into the app's SQLite file rather than adding a
 * "populate" button to the app. Seeding code then cannot ship to anyone: there
 * is no dev-only branch to misconfigure, and the Release build on the
 * simulator needs no rebuild to pick it up.
 *
 * The form definition is imported from src/forms rather than hand-copied, so
 * the generated answers always match the real starter form — including the
 * per-score word lists.
 *
 * SIMULATOR ONLY. It locates the app container through `xcrun simctl`, which
 * has no equivalent for a physical device.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname;

/* ------------------------------------------------------------------ args */

function parseArgs(argv) {
  const opts = { days: 60, seed: 1, keep: false, device: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--days') opts.days = Number(argv[++i]);
    else if (a === '--seed') opts.seed = Number(argv[++i]);
    else if (a === '--device') opts.device = argv[++i];
    else if (a === '--keep') opts.keep = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!Number.isInteger(opts.days) || opts.days < 1 || opts.days > 1000) {
    throw new Error('--days must be between 1 and 1000');
  }
  return opts;
}

/* ------------------------------------------------------- deterministic rng */

/** mulberry32 — same --seed always produces the same journal. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------- locate the device */

function bundleId() {
  return JSON.parse(execFileSync('node', ['-p', "JSON.stringify(require('./app.json').expo.ios.bundleIdentifier)"], { cwd: ROOT, encoding: 'utf8' }));
}

function bootedDevice() {
  const out = execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted'], { encoding: 'utf8' });
  const match = out.match(/[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}/);
  return match ? match[0] : null;
}

function databaseFor(device, bundle) {
  let container;
  try {
    container = execFileSync('xcrun', ['simctl', 'get_app_container', device, bundle, 'data'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new Error(
      `${bundle} is not installed on ${device}.\n` +
        'Install it first:  make sim'
    );
  }
  const dir = join(container, 'Documents', 'SQLite');
  if (!existsSync(dir)) {
    throw new Error('The app has no database yet. Launch it once, then re-run.');
  }
  const file = readdirSync(dir).find((f) => f.endsWith('.db'));
  if (!file) throw new Error(`No .db file under ${dir}`);
  return join(dir, file);
}

/* ------------------------------------------------- the real starter form */

/**
 * Compiles src/forms with the project's own tsc and returns its exports, so
 * the seeded answers cannot drift from the form the app actually renders.
 */
async function loadForms() {
  const out = mkdtempSync(join(tmpdir(), 'moodtracker-seed-'));
  try {
    execFileSync(
      'npx',
      ['tsc', 'src/forms/index.ts', '--ignoreConfig', '--outDir', out, '--rootDir', 'src',
        '--module', 'commonjs', '--target', 'es2020', '--moduleResolution', 'node',
        '--esModuleInterop', '--skipLibCheck', '--ignoreDeprecations', '6.0'],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return { mod: await import(pathToFileURL(join(out, 'forms/index.js')).href), out };
  } catch (error) {
    rmSync(out, { recursive: true, force: true });
    throw error;
  }
}

/* --------------------------------------------------------------- content */

const EXERCISE_YES = ['Short walk', 'Gym, upper body', 'Cycled to the shops', 'Swim', 'Long walk by the river', 'Yoga'];
const EXERCISE_NO = ['Too tired', 'Rained all day', 'Ran out of time', 'Not today', 'Work ran late'];
const LONELY_NOTES = ['Quiet evening.', 'Everyone was busy.', 'Felt it most after dinner.', 'Passed once I called someone.'];
const FATIGUE_NOTES = ['Slept badly.', 'Woke up a few times.', 'Better after a nap.', 'Heavy afternoon.'];
const JUNK = ['Takeaway pizza', 'Chips', 'Burger on the way home', 'Leftover party food'];
const SUGAR = ['Flat white with syrup', 'Two biscuits', 'Slice of cake', 'Can of cola'];
const MOOD_NOTES = ['Steady sort of day.', 'Good call with a friend.', 'Work was heavy.', 'Nothing much happened.'];
// Deliberately mild. This is placeholder data for exercising the UI, not a
// realistic depiction, and it should not read as distressing in a screenshot.
const SELF_HARM = ['Brief thought, passed quickly.', "Nothing serious, noting it so there's a record."];

const pick = (r, list) => list[Math.floor(r() * list.length)];
const chance = (r, p) => r() < p;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** ISO string for a local date at a given hour/minute. */
function at(day, hour, minute) {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function buildEntries(fields, days, seed) {
  const r = rng(seed);
  const byId = Object.fromEntries(fields.map((f) => [f.id, f]));
  const wordsFor = (fieldId, score) => {
    const table = byId[fieldId]?.optionsByScore;
    const list = table?.[String(score)];
    return list?.length ? pick(r, list) : null;
  };

  const entries = [];
  // A slow drift so Trends shows a shape rather than pure noise.
  let baseline = 5 + r() * 1.5;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);

    baseline = clamp(baseline + (r() - 0.48) * 0.55, 2.2, 8.4);
    if (chance(r, 0.14)) continue; // a day with nothing logged

    const perDay = chance(r, 0.25) ? 2 + (chance(r, 0.3) ? 1 : 0) : 1;
    for (let n = 0; n < perDay; n += 1) {
      const hour = [8, 13, 20][n] ?? 22;
      const createdAt = at(day, hour + Math.floor(r() * 2), Math.floor(r() * 60));

      const mood = clamp(Math.round(baseline + (r() - 0.5) * 2.4), 0, 10);
      // Fatigue tracks against mood, loosely — bad days tend to be tired days.
      const fatigue = clamp(Math.round(10 - mood + (r() - 0.5) * 3), 0, 10);

      const values = { mood_score: mood, fatigue_score: fatigue };

      const moodWord = wordsFor('mood_word', mood);
      if (moodWord && chance(r, 0.8)) values.mood_word = moodWord;
      const fatigueWord = wordsFor('fatigue_word', fatigue);
      if (fatigueWord && chance(r, 0.55)) values.fatigue_word = fatigueWord;

      if (chance(r, 0.25)) values.fatigue_note = pick(r, FATIGUE_NOTES);
      if (chance(r, 0.3)) values.mood_note = pick(r, MOOD_NOTES);

      if (chance(r, 0.6)) {
        const did = chance(r, 0.55);
        values.exercised = did;
        if (chance(r, 0.6)) values.exercise_note = pick(r, did ? EXERCISE_YES : EXERCISE_NO);
      }

      if (chance(r, 0.18)) {
        values.lonely_at = at(day, 18 + Math.floor(r() * 4), Math.floor(r() * 60));
        if (chance(r, 0.5)) values.lonely_note = pick(r, LONELY_NOTES);
      }

      if (chance(r, 0.45)) values.last_vegetable_at = at(day, 12 + Math.floor(r() * 7), Math.floor(r() * 60));
      if (chance(r, 0.22)) {
        values.last_junk_food_at = at(day, 12 + Math.floor(r() * 8), Math.floor(r() * 60));
        if (chance(r, 0.6)) values.junk_food_note = pick(r, JUNK);
      }
      if (chance(r, 0.3)) {
        values.last_processed_sugar_at = at(day, 10 + Math.floor(r() * 9), Math.floor(r() * 60));
        if (chance(r, 0.6)) values.processed_sugar_note = pick(r, SUGAR);
      }

      // Rare on purpose: enough to exercise the field, not enough to dominate.
      if (chance(r, 0.04)) values.self_harm_thoughts = pick(r, SELF_HARM);

      // Drop anything the form does not define, so a trimmed starter form
      // cannot produce orphaned answers.
      for (const key of Object.keys(values)) if (!byId[key]) delete values[key];

      entries.push({
        id: `seed-${offset}-${n}-${Math.floor(r() * 1e6).toString(36)}`,
        createdAt,
        updatedAt: createdAt,
        values,
      });
    }
  }
  return entries;
}

/* ----------------------------------------------------------------- write */

const sql = (s) => `'${String(s).replace(/'/g, "''")}'`;

function writeAll(db, statements) {
  const file = join(mkdtempSync(join(tmpdir(), 'moodtracker-sql-')), 'seed.sql');
  writeFileSync(file, `BEGIN;\n${statements.join('\n')}\nCOMMIT;\n`);
  execFileSync('sqlite3', [db], { input: `.read ${file}\n`, stdio: ['pipe', 'pipe', 'pipe'] });
  rmSync(file, { force: true });
}

/* ------------------------------------------------------------------ main */

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('usage: npm run seed -- [--days N] [--seed N] [--device UDID] [--keep]');
    return;
  }

  const bundle = bundleId();
  const device = opts.device ?? bootedDevice();
  if (!device) throw new Error('No booted simulator. Boot one, or pass --device <udid>.');

  const db = databaseFor(device, bundle);

  // SQLite is in WAL mode and the app holds it open; writing underneath a
  // running app risks the two disagreeing about what is on disk.
  try {
    execFileSync('xcrun', ['simctl', 'terminate', device, bundle], { stdio: 'ignore' });
  } catch {
    // Not running. Fine.
  }

  const { mod: forms, out } = await loadForms();
  try {
    const form = forms.starterForm();
    const entries = buildEntries(form.fields, opts.days, opts.seed);
    const now = new Date().toISOString();

    const statements = [];
    if (!opts.keep) statements.push("DELETE FROM docs WHERE collection='entry';");
    statements.push("DELETE FROM docs WHERE collection='form';");
    statements.push(
      'INSERT INTO docs (collection,id,created_at,updated_at,json) VALUES ' +
        `('form','current',${sql(now)},${sql(now)},${sql(JSON.stringify(form))});`
    );
    for (const e of entries) {
      statements.push(
        'INSERT OR REPLACE INTO docs (collection,id,created_at,updated_at,json) VALUES ' +
          `('entry',${sql(e.id)},${sql(e.createdAt)},${sql(e.updatedAt)},${sql(JSON.stringify({ values: e.values }))});`
      );
    }
    writeAll(db, statements);

    const answered = entries.reduce((n, e) => n + Object.keys(e.values).length, 0);
    const dayCount = new Set(entries.map((e) => e.createdAt.slice(0, 10))).size;
    console.log(`Seeded "${form.fields.length}-field" starter form on ${device}`);
    console.log(`  ${entries.length} entries across ~${dayCount} days (${opts.days} requested)`);
    console.log(`  ${answered} answers total, seed=${opts.seed}`);
    console.log(`\nRelaunch:  xcrun simctl launch ${device} ${bundle}`);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

try {
  await main();
} catch (error) {
  console.error(`seed failed: ${error.message}`);
  if (error.stderr) console.error(error.stderr.toString());
  process.exitCode = 1;
}
