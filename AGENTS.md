This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Architecture

The form is **user-defined**, so an entry's shape is not known until runtime.
Read `src/forms/types.ts` and `src/store/docs.ts` before changing anything that
touches stored data.

- **No typed columns for answers.** Everything lives in one `docs` table whose
  payload is JSON (`collection`, `id`, `created_at`, `updated_at`, `json`).
  Adding a field kind or an option is a data change, not a migration.
- **Nothing read from disk is trusted.** `src/forms/normalize.ts` coerces
  untrusted JSON into a valid form or entry and drops what it cannot salvage.
  Route every read through it rather than casting.
- **Field ids are permanent.** Answers key off the id, never the label. Deleting
  a field archives it by default so old entries still render; erasing its
  answers is a separate, explicitly confirmed action.
- **Nothing touches the network.** This is a privacy-focused local journal:
  no account, no sync, no analytics. The only way data leaves the device is the
  user explicitly exporting a backup through the OS share sheet. Do not add a
  dependency that phones home.

`npx expo lint` is broken against the installed eslint (a version-gate bug), so
use `npm run lint`, which calls eslint directly.
