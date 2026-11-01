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

ARCHIVE="$ROOT/ios/build/MoodTracker.xcarchive"
IPA_DIR="$ROOT/ios/build/ipa"

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

# Keep DerivedData inside the project.
#
# Without this, xcodebuild uses the shared ~/Library/Developer/Xcode/DerivedData,
# which it also shares with the Xcode GUI and with every earlier run. Because
# prebuild --clean rebuilds Pods from scratch each time, a build description
# cached there can outlive the Pods tree it describes and the archive fails
# with "Unable to load contents of file list: ...xcfilelist" — files that are
# sitting right there on disk. A per-project path cannot go stale that way,
# and `rm -rf ios` resets everything in one step.
DERIVED="$ROOT/ios/build/DerivedData"

echo "==> Archiving for device"
rm -rf "$ARCHIVE"
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
