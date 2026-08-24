# Contributing to Amy

Thanks for helping Amy get better. The goal is a calm, fast Android calorie tracker where logging feels like writing one food per line.

## Before Opening an Issue

Use the issue forms so maintainers can reproduce problems quickly:

- Bug reports: crashes, broken app behavior, wrong data handling, layout bugs, widget bugs, barcode/photo/mic problems.
- Install or compatibility reports: APK install failures, device-specific rendering problems, Android version issues, widget launcher problems.
- Feature requests: focused ideas that preserve Amy's fast one-line logging model.

For app bugs, include:

- Amy version and Android `versionCode`.
- Install source, such as GitHub Releases, EAS preview, local build, or another catalog.
- Device model, Android version, and launcher name when widgets are involved.
- Clear steps to reproduce, expected behavior, and actual behavior.
- Screenshot, screen recording, logs, or exported sample data when it is safe to share.

Do not paste OpenRouter keys, personal health information, private diary exports, or other secrets into public issues.

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

## Development Workflow

1. Create a focused branch from `main`.
2. Keep the change small enough to review in one pass.
3. Follow the existing React Native and Expo patterns in `src/`.
4. Add or update docs when behavior, permissions, storage shape, release process, or distribution status changes.
5. Run the verification commands that match the risk of the change.

For storage or import/export changes, preserve backward compatibility when possible and document migration behavior in the PR.

For Android widget, permission, config plugin, package metadata, or native build changes, run a prebuild check before requesting review.

## Pull Request Checklist

Before opening a PR:

- Run `npm test`.
- Run `npm run check:deps`.
- Keep changes narrowly scoped and explain the user-facing behavior.
- Include screenshots or notes for visible UI changes.
- Confirm import/export still preserves user data when storage shapes change.
- Run `npm run prebuild:android` for widget, permission, config-plugin, or native-related changes.
- Update `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` for release-bound changes.
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

Release candidates follow [docs/RELEASE_PROCESS.md](docs/RELEASE_PROCESS.md). Public APKs must be signed with the maintainer release key or EAS release credentials, not the Android debug certificate. The IzzyOnDroid artifact is the arm64-v8a APK attached to a GitHub Release. Do not add an official f-droid.org `fdroiddata` recipe unless a maintainer explicitly asks; barcode scanning keeps Google ML Kit.

## Distribution and IzzyOnDroid Work

Amy is licensed under GPL-3.0-or-later. The intended catalog is IzzyOnDroid, not official f-droid.org.

Distribution contributions are welcome when they keep that path clear:

- Improve GitHub Release notes, checksums, screenshots, Fastlane metadata, or Android catalog metadata.
- Test source builds from a clean temp checkout.
- Document catalog requirements, signing, ABI splits, and optional-network disclosures.
- Do not strip `expo-camera` / ML Kit or `expo-location` to chase f-droid.org.

The current audit lives in [docs/FDROID_READINESS_AUDIT.md](docs/FDROID_READINESS_AUDIT.md).

## Licensing

By submitting a contribution, you agree that your contribution is licensed under the GNU General Public License v3.0 or later, the same license as the project.

Third-party packages keep their original licenses; do not claim they are GPL.

## Contact

For questions before a larger change, open an issue or email [kausthubh2007@gmail.com](mailto:kausthubh2007@gmail.com).
