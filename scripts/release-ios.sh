#!/bin/sh
#
# Builds a signed .ipa for App Store Connect, ready to drag into Transporter.
#
#   npm run release:ios
#
# Everything here runs locally through Xcode. EAS is not involved, and no
# Expo account is needed — `expo prebuild` only regenerates ios/ from app.json.
#
# Requires a PAID Apple Developer Program membership. The free tier can issue
# an "Apple Development" certificate but not the "Apple Distribution" one the
# App Store requires, so the signing step below will fail without it.

set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

# Build outputs live at the repo root, deliberately NOT under ios/.
# `expo prebuild --clean` deletes ios/ wholesale, so anything kept there is
# re-deleted on every release — slow for a multi-gigabyte DerivedData tree,
# and it fails outright with ENOTEMPTY while Xcode still holds files open.
# Keeping them here also means the .ipa you just built survives the next run.
OUT="$ROOT/build"
ARCHIVE="$OUT/MoodTracker.xcarchive"
IPA_DIR="$OUT/ipa"
DERIVED="$OUT/DerivedData"

version=$(node -p "require('./app.json').expo.version")
build=$(node -p "require('./app.json').expo.ios.buildNumber ?? ''")

if [ -z "$build" ]; then
  echo "error: expo.ios.buildNumber is not set in app.json." >&2
  echo "       Without it prebuild writes CFBundleVersion=1 every run, and" >&2
  echo "       App Store Connect rejects a duplicate build number." >&2
  exit 1
fi

echo "Mood Tracker $version (build $build)"
echo

# Warn, but do not block. A missing distribution certificate has two very
# different causes, and only one of them is fatal:
#
#   - Paid membership, certificate not created yet. The
#     -allowProvisioningUpdates flag below creates it, so stopping here would
#     prevent the very thing that fixes the problem.
#   - Free account. Apple will not issue a distribution certificate at all,
#     and xcodebuild fails later with its own error.
#
# Since this script cannot tell the two apart, it explains the likely cause
# and lets xcodebuild be the authority.
if ! security find-identity -v -p codesigning 2>/dev/null | grep -q "Apple Distribution"; then
  echo "note: no 'Apple Distribution' certificate in your keychain yet."
  echo
  echo "      Continuing anyway — -allowProvisioningUpdates can create one if"
  echo "      your Apple ID has a paid Developer Program membership. If it"
  echo "      does not, xcodebuild will fail at the signing step, and the"
  echo "      membership is what you are missing."
  echo
  echo "      To check: Xcode > Settings > Apple Accounts > Manage"
  echo "      Certificates... > + . If 'Apple Distribution' is offered, you"
  echo "      are on a paid account; a free one only offers development certs."
  echo
  echo "      Current identities:"
  security find-identity -v -p codesigning 2>/dev/null | sed 's/^/      /'
  echo
fi

echo "==> Regenerating ios/ from app.json"
npx expo prebuild --platform ios --clean

# Discard DerivedData before archiving.
#
# xcodebuild otherwise uses the shared ~/Library/Developer/Xcode/DerivedData,
# which it also shares with the Xcode GUI and every earlier run. Since the
# prebuild above rebuilds ios/Pods from scratch, a build description cached
# there outlives the Pods tree it describes, and the archive fails with
# "Unable to load contents of file list: ...xcfilelist" naming files that are
# sitting right there on disk. A private, freshly emptied path cannot go
# stale that way.
echo "==> Archiving for device"
rm -rf "$ARCHIVE" "$DERIVED"
xcodebuild archive \
  -workspace ios/MoodTracker.xcworkspace \
  -scheme MoodTracker \
  -configuration Release \
  -sdk iphoneos \
  -archivePath "$ARCHIVE" \
  -derivedDataPath "$DERIVED" \
  -allowProvisioningUpdates

echo "==> Exporting .ipa"
rm -rf "$IPA_DIR"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist scripts/ExportOptions.plist \
  -exportPath "$IPA_DIR" \
  -allowProvisioningUpdates

echo
echo "Done. Open Transporter and drop in:"
find "$IPA_DIR" -name '*.ipa' -maxdepth 1 | sed 's/^/  /'
echo
echo "Before the next upload, bump expo.ios.buildNumber in app.json —"
echo "App Store Connect rejects a duplicate build number for the same version."
