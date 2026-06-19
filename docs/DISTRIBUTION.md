# Amy Distribution Checklist

## GitHub

- Create a GitHub repository and add it as `origin`.
- Keep `.env`, APKs, `android/`, `ios/`, `artifacts/`, `builds/`, and raw screenshot dumps out of git.
- Run `npm test` before every release.
- Run `npx expo prebuild --platform android --no-install` after widget or native config changes.
- Upload signed APK/AAB artifacts through GitHub Releases after the build completes.

## Android Builds

- Local Gradle builds require a Java runtime and Android SDK.
- EAS preview builds produce installable APKs with the `preview` profile in `eas.json`.
- Production store builds should use the `production` profile and Android App Bundle output.

## API Key Safety

- OpenRouter keys are stored locally in app storage.
- Amy JSON exports intentionally clear `openRouterKey`.
- `.easignore` excludes `.env` and generated artifacts from EAS upload.

## F-Droid Prep

- Keep all required source code and config in the repository.
- Document non-free network services clearly: OpenRouter is optional and user-supplied; Open Food Facts is used for barcode/product lookup.
- Avoid committing generated native folders unless the distribution process specifically requires them.
- Provide screenshots from `docs/screenshots/`.
