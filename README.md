# Amy

Amy is a local-first Expo Android calorie tracker built around fast meal logging.

![Amy Today](docs/screenshots/today.png)

## Scope

- Open Food Facts is the only barcode/product nutrition database.
- OpenRouter powers AI meal, photo, label, and dictation estimates when configured.
- Diary data, saved meals, goals, corrections, export, and import stay on device.
- No menu scanning, FatSecret, USDA, dual lookup, water tracking, or water goals.
- Today is a line log: pressing Enter starts estimating the completed line as one food or meal.
- Weight tracking is local and lives with goals, stats, export, and import.

## Screenshots

| Onboarding | Today | Searching | Logged line | Settings |
| --- | --- | --- | --- | --- |
| ![Onboarding](docs/screenshots/onboarding.png) | ![Today](docs/screenshots/today.png) | ![Searching](docs/screenshots/searching.png) | ![Logged line](docs/screenshots/ai-log.png) | ![Settings](docs/screenshots/settings.png) |

## Android APK

The tested local release APK is published from GitHub Releases, not committed to the repository.

Latest local build before release upload:

```text
builds/amy-release-local.apk
SHA-256: a413984ca9a2a82ec28582bbe0043b5e214cbfc0a0efc585eb926e5d26ad4dbb
```

## Development

```sh
npm install
npm test
npx expo start
```

OpenRouter is configured inside the app from Settings. Do not commit personal credentials.

## Distribution

See [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md) for GitHub release, APK, and F-Droid prep notes.
