// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // Cannot follow `export *` re-exports through a dependency's build output
      // (expo-notifications re-exports its enums that way), and TypeScript
      // already checks every namespace member access via `tsc --noEmit`.
      'import/namespace': 'off',
    },
  },
]);
