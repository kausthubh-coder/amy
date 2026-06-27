# Amy

This folder is the new Amy app planning workspace. The current artifact is an implementation plan for an Expo Android calorie tracker inspired by the supplied Amy screenshots and teardown.

Constraints to preserve:

- Use Open Food Facts as the only nutrition database for barcode/product lookup.
- Use OpenRouter for AI text, image, label, and dictation reasoning.
- Do not add menu scanning.
- Do not add FatSecret, USDA, or any dual nutrition lookup.
- Do not add water tracking, water goals, water quick-add, or water widgets.
- Do not require birthday, gender, height, or activity onboarding.
- Use custom calorie target plus weight goal as the main setup path.
- Today supports previous/next day swiping and a calorie detail modal from the calorie pill.
- Today is a line log: each typed line maps to one food/meal with a right-side loading/calorie state.
- The plus button opens saved meals, not a generic add menu.
- Stats has two screens/tabs: Stats and Streaks.
- Plan two Android widgets: calories remaining, and a mini Today widget with deep links to type, barcode, camera, mic, and saved meals.
- Build for Android with Expo/EAS and produce an installable APK.
- Keep the end goal simple: make calories easy to log, verify, edit, and review.

Reference inputs checked:

- `/Users/kaust/Documents/coding/sandbox/fatass/.artifacts/video-feature-teardown/amy-reference-teardown.html`
- `/Users/kaust/Documents/coding/sandbox/fatass/.artifacts/video-feature-teardown/source-metadata.json`
- `/Users/kaust/Documents/amy/screenshots/*.png`
- `/Users/kaust/Documents/amy/screenshots/latest/*.PNG`
- `/Users/kaust/Documents/amy/assets/amy-app-icon-dark-light-concept.png`

OpenRouter credentials are entered in Settings and stored locally. Do not add personal credentials to the repository.

## Current Workflow

Amy is an Expo/React Native Android calorie tracker focused on fast daily food logging:

- Today is the main working surface. Users type one food per line, use mic/photo/barcode/saved-meal actions from the dock, and see calories aligned on the right rail.
- Capture/photo/barcode flows should add both structured calories/macros and a visible note line for the selected day.
- Stats has two top tabs: Stats and Streaks. Stats shows weekly bars with actual totals. Streaks shows current contiguous streak, total logged days, today eaten, week total, macro totals, and the month calendar.
- Android has two widgets: calories summary and mini Today actions. Widget deep links use `amy://...` routes.

## Run, Test, Build, Verify

- Start Metro: `npm run dev`
- Type-check: `npm test`
- Dependency sanity: `npm run check:deps`
- Expo project sanity: `npx expo-doctor`
- Generate native Android project when needed: `npm run prebuild:android`
- Local release APK: `ANDROID_HOME="$HOME/Library/Android/sdk" ANDROID_SDK_ROOT="$HOME/Library/Android/sdk" npm run build:local:android`
- EAS preview APK: `npm run build:preview:android`

Keep generated `android/` and bulky APK outputs out of commits unless the user explicitly asks otherwise. Local APKs live under `builds/`.

## Architecture Map

- `App.tsx`: root shell, onboarding/settings/modal routing, Stats modal tab state.
- `src/screens/TodayScreen.tsx`: main line-log editor, calorie rail, bottom dock, goals card, streak pill.
- `src/screens/CaptureModal.tsx`: text/photo/barcode/mic capture flows and OpenRouter/Open Food Facts integration surfaces.
- `src/screens/StatsModal.tsx`: Stats/Streaks tabs, weekly charts, streak calendar and summary cards.
- `src/store/AppDataContext.tsx`: persistent app state, entries, note lines, saved meals, app settings, widget refresh bridge.
- `src/domain/streaks.ts`: contiguous current streak and total logged-days helpers.
- `src/components/NutritionBits.tsx`: goal and macro progress components.
- `plugins/withAmyAndroidWidgets.js`: Android widget providers, XML layouts, vector icons, and widget metadata generated during prebuild.

## Environment And Secrets

OpenRouter keys are user-entered in Settings and stored locally. Do not commit real keys or paste them into artifacts. Open Food Facts remains the only product nutrition database. Expo/EAS credentials are expected to come from the local developer environment.

## Artifact Map

- Plans: `.artifacts/plans/`
- Conclusions: `.artifacts/conclusions/`
- Demo screenshots and recordings: `.artifacts/demos/`
- Sandboxes/prototypes, if used later: `.sandbox/`

## Known Gaps

- Widget visual behavior still needs a launcher/home-screen resize check on a physical Android launcher or emulator launcher that supports adding widgets interactively.
- Photo analysis depends on a valid OpenRouter key and network access; emulator smoke testing can verify navigation/UI without proving paid model responses.
- Local builds may require `ANDROID_HOME`/`ANDROID_SDK_ROOT` to be exported explicitly.

## Last Meaningful Oracle Update

2026-06-27: Oracle pass for photo note-line visibility, widget fire/resize consistency, macro progress rings, contiguous streak semantics, Stats/Streaks header cleanup, streak detail totals, Today calorie rail scroll alignment, and Android 1.0.6/versionCode 8 build prep. Evidence is in `.artifacts/plans/20260627-0102-amy-logging-widget-stats-plan.html` and `.artifacts/conclusions/20260627-0102-amy-logging-widget-stats-conclusion.html`.
