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
- The plus button opens saved meals, not a generic add menu.
- Stats has two screens/tabs: Stats and Streaks.
- Plan two Android widgets: calories remaining, and a mini Today widget with deep links to type, barcode, camera, mic, and saved meals.
- Build for Android with Expo/EAS and produce an installable APK.
- Keep the end goal simple: make calories easy to log, verify, edit, and review.

Reference inputs checked:

- `/Users/kaust/Documents/coding/sandbox/fatass/.artifacts/video-feature-teardown/amy-reference-teardown.html`
- `/Users/kaust/Documents/coding/sandbox/fatass/.artifacts/video-feature-teardown/source-metadata.json`
- `/Users/kaust/Documents/coding/sandbox/fatass/.env.example`
- `/Users/kaust/Documents/amy/screenshots/*.png`
- `/Users/kaust/Documents/amy/screenshots/latest/*.PNG`
- `/Users/kaust/Documents/amy/assets/amy-app-icon-dark-light-concept.png`

The Fatass env example only contains placeholders. Use these variable names during implementation, but do not commit real secrets:

- `EXPO_PUBLIC_OPENROUTER_API_KEY`
- `EXPO_PUBLIC_OPENROUTER_MODEL`
- `EXPO_PUBLIC_OPENROUTER_WEB_SEARCH`
