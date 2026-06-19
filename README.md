# Amy

Amy is a local-first Expo Android calorie tracker built around fast meal logging.

## Scope

- Open Food Facts is the only barcode/product nutrition database.
- OpenRouter powers AI meal, photo, label, and dictation estimates when configured.
- Diary data, saved meals, goals, corrections, export, and import stay on device.
- No menu scanning, FatSecret, USDA, dual lookup, water tracking, or water goals.

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

Set these environment variables locally when AI estimates are needed:

```sh
EXPO_PUBLIC_OPENROUTER_API_KEY=
EXPO_PUBLIC_OPENROUTER_MODEL=
EXPO_PUBLIC_OPENROUTER_WEB_SEARCH=true
```

Do not commit real API keys.
