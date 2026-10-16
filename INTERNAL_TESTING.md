# Internal testing on a physical iPhone

How to get a **real, standalone build** of Mood Tracker onto an actual iPhone.
Two routes are covered:

| Route | Apple account needed | Cost | Install validity | Good for |
| --- | --- | --- | --- | --- |
| [Local Release build over USB](#route-a--local-release-build-over-usb-free) | Free Apple ID | free | **7 days** | Testing on your own phone |
| [EAS internal distribution](#route-b--eas-internal-distribution-over-the-air) | Paid Developer Program | $99/yr | 1 year | Handing builds to other testers |

Route A is the one to reach for day to day. It needs no paid membership and no
cloud build — just Xcode and a cable.

> **This is not the same as `npm run ios:device`.** That script builds a
> **Debug** dev client, which needs Metro running on your Mac to do anything.
> The builds below are **Release** builds: the JavaScript is bundled into the
> binary, so the app runs standalone with your laptop nowhere in sight. That is
> what makes it a real test.

---

## Route A — local Release build over USB (free)

### 1. Sign in to Xcode once

**Xcode → Settings (⌘,) → Accounts → `+` → Apple ID**, then sign in with an
ordinary Apple ID. No paid membership, no payment details.

Xcode then creates an "Apple Development" certificate for you and a team named
**"Your Name (Personal Team)"**. Confirm it worked:

```bash
security find-identity -v -p codesigning
```

You want at least one identity listed. **`0 valid identities found` means the
sign-in has not taken effect**, and the build will fail with:

```
CommandError: No code signing certificates are available to use.
```

If Xcode does not pick the team up automatically, set it by hand — open the
workspace with `xed ios`, select the project in the navigator, then the
**MoodTracker** target, then **Signing & Capabilities**. Tick **Automatically
manage signing** and choose your Personal Team under **Development Team**.
Expo's own write-up of this screen is at
[expo.fyi/setup-xcode-signing](https://github.com/expo/fyi/blob/main/setup-xcode-signing.md).

### 2. Enable Developer Mode on the phone

Required on iOS 16 and later. On the iPhone: **Settings → Privacy & Security →
Developer Mode → on**, then reboot when it asks. The toggle only appears after
the phone has been connected to Xcode at least once.

### 3. Build and install

Plug the phone in, tap **Trust** on its prompt, then:

```bash
npx expo run:ios --device --configuration Release
```

Expo lists the attached devices, bundles the JS, compiles the Release
configuration, signs it with your Personal Team, and installs over the cable.
The first build takes several minutes.

### 4. Trust the developer certificate on the phone

The app installs but **refuses to launch**, showing an "Untrusted Developer"
dialog. This is expected and catches everyone out. On the iPhone:

**Settings → General → VPN & Device Management → [your Apple ID] → Trust**

Older iOS labels that middle entry **Device Management** rather than **VPN &
Device Management**. Once trusted, the app opens normally, and you only need to
repeat this when the signing certificate changes — not on every rebuild.

---

## The push-notification trap

**A free Personal Team cannot sign the Push Notifications capability.** If
`app.json` carries

```json
["expo-notifications", { "enableRemoteNotifications": true }]
```

then prebuild writes an `aps-environment` key into
`ios/MoodTracker/MoodTracker.entitlements`, and the Release build dies with:

```
Personal development teams do not support the Push Notifications capability.
```

`enableRemoteNotifications` is therefore **`false`** in `app.json`, and the
entitlements file is expected to be an empty `<dict/>`.

Nothing is lost by this. Mood Tracker's reminders are scheduled **locally** by
the OS through `expo-notifications` (see
[Reminders](README.md#reminders) in the README) and **local notifications
require no entitlement at all**. The app holds no push token and makes no
network calls, so there is nothing for APNs to deliver. Remote push was never
wired up — the flag was adding an entitlement for a feature the app does not
have.

If you ever take out a paid membership and genuinely want remote push, flip the
flag back to `true` and re-run prebuild.

### Checking the entitlements are clean

```bash
cat ios/MoodTracker/MoodTracker.entitlements   # expect: <dict/>
```

---

## Re-run prebuild after touching `app.json`

`ios/` is generated and gitignored, so it can silently fall out of step with
`app.json` — the native project keeps whatever config it was born with. After
any change to `app.json`, plugins, or app icons:

```bash
npx expo prebuild --platform ios --clean
```

A stale `ios/` folder is a genuinely confusing failure mode: the build succeeds
and installs, but behaves according to config you already edited. Compare the
timestamps if something looks wrong:

```bash
stat -f '%Sm  %N' app.json ios
```

---

## Living with the free tier

| Limit | Value |
| --- | --- |
| Provisioning profile validity | **7 days**, then the app will not launch |
| New App IDs | 10 per 7 days |
| Free-provisioned apps per device | commonly capped at 3 at once |
| Push notifications | unavailable (not needed — see above) |

When the week is up, the app shows a launch error. Fix it by building again:

```bash
npx expo run:ios --device --configuration Release
```

**Your logged data survives a rebuild.** Installing over the top of an existing
app keeps its private container, so the SQLite database is untouched. Deleting
the app from the home screen *does* delete the database — there is no server
copy and no backup beyond your encrypted iPhone backups.

---

## Route B — EAS internal distribution (over the air)

Worth it when you want builds on **other people's** phones, or on your own
without a cable and without the 7-day clock. Requires the paid Apple Developer
Program, since internal distribution uses ad-hoc provisioning.

Run everything through `npm run eas` so the build lands on the personal Expo
account rather than the globally logged-in one — see
[Using your personal Expo account](README.md#using-your-personal-expo-account-not-caitcommittee).

```bash
npm run eas -- whoami                                     # expect: kalobtaulien
npm run eas -- device:create                              # register each tester's UDID
npm run eas -- build --platform ios --profile preview     # release build, internal distribution
```

EAS offers to generate the distribution certificate and provisioning profile
for you; let it. When the build finishes it prints a QR code — scan it on any
registered device and the app installs over the air.

**Every device must be registered before the build**, not after. A profile only
covers the UDIDs known at build time, so adding a tester means re-running
`device:create` and building again.

The `preview` profile is defined in `eas.json` on channel `preview`. For the
App Store / TestFlight path instead, see
[TestFlight](README.md#testflight) in the README.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `No code signing certificates are available to use.` | No Apple ID in Xcode | [Sign in](#1-sign-in-to-xcode-once); verify with `security find-identity -v -p codesigning` |
| `Personal development teams do not support the Push Notifications capability.` | `aps-environment` in entitlements | Set `enableRemoteNotifications` to `false`, re-run prebuild |
| "Untrusted Developer" on launch | Certificate not trusted on device | [Trust it in Settings](#4-trust-the-developer-certificate-on-the-phone) |
| App launched fine last week, now errors | 7-day profile expired | Rebuild; data is preserved |
| Device missing from the `--device` list | Developer Mode off, or Mac not trusted | [Enable Developer Mode](#2-enable-developer-mode-on-the-phone), re-plug, tap Trust |
| Build works but behaves like old config | Stale generated `ios/` | `npx expo prebuild --platform ios --clean` |
| App needs Metro to start | Built Debug, not Release | Pass `--configuration Release` |
