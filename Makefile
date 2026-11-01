# Mood Tracker — task runner.
#
#   make            list every target
#   make check      typecheck, lint and the storage checks
#   make ipa        signed .ipa for Transporter
#
# Targets wrap the npm scripts rather than repeating their commands, so
# package.json stays the single source of truth for how each one runs.
#
# EAS targets go through scripts/eas.sh, never a bare `eas`. EAS CLI keeps its
# login in ~/.expo/state.json globally, so `eas login` in any other project
# silently repoints this one; the wrapper pins the account with a project-local
# EXPO_TOKEN. See "Using your personal Expo account" in README.md.

# Read identity from app.json so it cannot drift from what actually ships.
# Lazy (=, not :=) so plain `make help` does not pay for two node startups.
BUNDLE_ID = $(shell node -p "require('./app.json').expo.ios.bundleIdentifier")
APP_NAME = MoodTracker

# The booted simulator. Override when more than one is running, or when the one
# you want is not booted yet:  make sim SIM=<udid>
# List candidates with:        xcrun simctl list devices available
SIM ?= $(shell xcrun simctl list devices booted 2>/dev/null | \
	grep -Eo '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}' | head -1)

APP_PATH = build/SimRelease/Build/Products/Release-iphonesimulator/$(APP_NAME).app

.DEFAULT_GOAL := help

##@ Getting started

help: ## List every target
	@awk 'BEGIN {FS = ":.*##"} \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2 }' \
		$(MAKEFILE_LIST)
	@echo ""

install: ## Install npm dependencies
	npm install

##@ Develop

start: ## Start Metro for an already-installed dev client
	npm start

ios: ## Build and run the dev client on a simulator
	npm run ios

device: ## Build and run the dev client on a USB-connected iPhone
	npm run ios:device

android: ## Build and run the dev client on Android
	npm run android

##@ Check

check: typecheck lint check-store ## Run every check (use this before committing)

typecheck: ## tsc --noEmit
	npm run typecheck

lint: ## eslint over app/ and src/
	npm run lint

check-store: ## Storage, migration and backup checks
	npm run check:store

doctor: ## Verify dependency versions against the installed Expo SDK
	npx expo-doctor

##@ Build locally

prebuild: ## Regenerate ios/ from app.json (needed after icon, splash or version changes)
	npx expo prebuild --platform ios --clean

sim: ## Release build installed and launched on the simulator (no Metro needed)
	@test -n "$(SIM)" || { \
		echo "No booted simulator found. Boot one, or pass SIM=<udid>."; \
		echo "Candidates:"; \
		xcrun simctl list devices available | grep -E "iPhone|iPad"; \
		exit 1; }
	@echo "Building for simulator $(SIM)"
	xcodebuild -workspace ios/$(APP_NAME).xcworkspace -scheme $(APP_NAME) \
		-configuration Release -sdk iphonesimulator \
		-destination "id=$(SIM)" \
		-derivedDataPath build/SimRelease \
		ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO build
	xcrun simctl install "$(SIM)" "$(APP_PATH)"
	xcrun simctl launch "$(SIM)" "$(BUNDLE_ID)"

ipa: ## Signed .ipa in build/ipa/ for Apple's Transporter app
	npm run release:ios

release: ipa ## Alias for `make ipa`

##@ Build on EAS (cloud)

build_ios: ## Production iOS build on EAS
	sh scripts/eas.sh build --platform ios --profile production

submit_ios: ## Submit the latest EAS build to App Store Connect
	sh scripts/eas.sh submit --platform ios --profile production

workflow: ## Run the create-production-builds EAS workflow
	sh scripts/eas.sh workflow:run create-production-builds.yml

whoami: ## Show which Expo account this project is using
	sh scripts/eas.sh whoami

##@ Assets and housekeeping

logo: ## Regenerate every icon and splash asset from scripts/make-logo.py
	python3 scripts/make-logo.py

clean: ## Delete build output (archive, DerivedData, .ipa)
	rm -rf build

clean-native: clean ## Also delete the generated ios/ directory
	rm -rf ios

.PHONY: help install start ios device android check typecheck lint check-store \
	doctor prebuild sim ipa release build_ios submit_ios workflow whoami \
	logo clean clean-native
