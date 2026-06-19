# Contributing to Amy

Amy is a local-first Expo Android calorie tracker. Keep changes focused on fast meal logging, editable estimates, Open Food Facts barcode lookup, and OpenRouter-powered AI estimates.

## Local setup

```sh
npm install
npm test
npm run dev
```

OpenRouter keys are entered inside the app during onboarding or Settings. Do not commit personal keys, `.env` files, APKs, native build folders, or generated screenshot dumps.

## Product boundaries

- Keep Open Food Facts as the only barcode/product nutrition database.
- Keep OpenRouter as the only AI provider.
- Do not add water tracking, menu scanning, USDA, FatSecret, or dual nutrition lookup.
- Preserve the Today line log: one line equals one food or meal.
- Preserve local data migration and export/import behavior when changing storage.

## Before opening a PR

```sh
npm test
npx expo prebuild --platform android --no-install
```

For APK work, use EAS preview builds or a local Android build machine with Java and the Android SDK installed.
