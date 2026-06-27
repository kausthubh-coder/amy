# Contributing to Amy

Thanks for helping Amy get better. The goal is a calm, fast Android calorie tracker where logging feels like writing one food per line.

## Good Contributions

- Bug fixes for logging, editing, import/export, barcode lookup, photo analysis, dictation, widgets, or Android layout issues.
- Better error states when OpenRouter, Open Food Facts, camera, gallery, storage, or permissions fail.
- Accessibility and keyboard polish.
- Documentation, release metadata, screenshots, and distribution prep.
- Small UI improvements that keep the app faster to use.

## Product Boundaries

Please keep Amy focused:

- Open Food Facts is the only barcode/product nutrition database.
- OpenRouter is the only AI provider.
- Manual logging must remain useful without an API key.
- Today is a line log: one completed line equals one food or meal.
- Diary data, saved meals, goals, corrections, exports, imports, and weight logs stay local.
- Do not add water tracking, menu scanning, USDA, FatSecret, MyFitnessPal, Nutritionix, auth, ads, tracking SDKs, or a second nutrition database.

## Local Setup

```sh
npm install
npm test
npm run dev
```

OpenRouter keys are entered inside the app during onboarding or Settings. Do not commit personal keys, `.env` files, APKs, native build folders, generated screenshot dumps, or local Expo artifacts.

## Pull Request Checklist

Before opening a PR:

- Run `npm test`.
- Keep changes narrowly scoped and explain the user-facing behavior.
- Include screenshots or notes for visible UI changes.
- Confirm import/export still preserves user data when storage shapes change.
- Run `npm run prebuild:android` for widget, permission, config-plugin, or native-related changes.
- Keep generated `android/` and `ios/` folders out of commits unless a maintainer explicitly asks for them.

## Android Builds

For normal app work, use Expo dev mode:

```sh
npm run dev
```

For preview APK work, use EAS or a temp local prebuild. Generated APKs belong in release artifacts, not in git.

```sh
npm run build:preview:android
```

## Licensing

By submitting a contribution, you agree that your contribution is provided under the same license as the project: PolyForm Noncommercial License 1.0.0.

Commercial use or commercial licensing requests should go to [kausthubh2007@gmail.com](mailto:kausthubh2007@gmail.com).

## Contact

For questions before a larger change, open an issue or email [kausthubh2007@gmail.com](mailto:kausthubh2007@gmail.com).
