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

# Fail early with an explanation rather than deep inside xcodebuild.
if ! security find-identity -v -p codesigning 2>/dev/null | grep -q "Apple Distribution"; then
  echo "error: no 'Apple Distribution' certificate found in your keychain." >&2
  echo >&2
  echo "       App Store signing needs a paid Apple Developer Program" >&2
  echo "       membership. Once enrolled, sign in under Xcode > Settings >" >&2
  echo "       Accounts and the -allowProvisioningUpdates flag below will" >&2
  echo "       create the certificate and profile for you." >&2
  echo >&2
  echo "       Current identities:" >&2
  security find-identity -v -p codesigning 2>/dev/null | sed 's/^/       /' >&2
  exit 1
fi

echo "==> Regenerating ios/ from app.json"
npx expo prebuild --platform ios --clean

echo "==> Archiving for device"
rm -rf "$ARCHIVE"
xcodebuild archive \
  -workspace ios/MoodTracker.xcworkspace \
  -scheme MoodTracker \
  -configuration Release \
  -sdk iphoneos \
  -archivePath "$ARCHIVE" \
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
