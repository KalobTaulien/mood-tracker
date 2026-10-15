#!/usr/bin/env sh
#
# Runs eas-cli against THIS project's Expo account.
#
# EAS CLI stores its login globally in ~/.expo/state.json, so `eas login` would
# switch accounts for every project on this machine. EXPO_TOKEN takes precedence
# over that stored session, so sourcing a project-local token keeps this project
# on a personal account while other projects stay on whatever is logged in.
#
# Usage:  npm run eas -- build --profile development --platform ios
#         npm run eas -- whoami
set -e

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TOKEN_FILE="$PROJECT_ROOT/.env.eas"

if [ -f "$TOKEN_FILE" ]; then
  # shellcheck disable=SC1090
  . "$TOKEN_FILE"
  export EXPO_TOKEN
fi

if [ -z "$EXPO_TOKEN" ]; then
  echo "No EXPO_TOKEN found." >&2
  echo "" >&2
  echo "  1. Sign in to https://expo.dev as your PERSONAL account" >&2
  echo "  2. Create a token at https://expo.dev/settings/access-tokens" >&2
  echo "  3. cp .env.eas.example .env.eas   and paste it in" >&2
  echo "" >&2
  echo "Without it, eas-cli would use the global login:" >&2
  echo "  $(npx --yes eas-cli@latest whoami 2>/dev/null || echo 'not logged in')" >&2
  exit 1
fi

exec npx --yes eas-cli@latest "$@"
