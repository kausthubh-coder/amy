# Amy Distribution Checklist

## GitHub

- Source repo: `https://github.com/kausthubh-coder/amy`
- Download page: `https://github.com/kausthubh-coder/amy/releases/latest`
- Keep `.env`, APKs, `android/`, `ios/`, `artifacts/`, `builds/`, and raw screenshot dumps out of git.
- Run `npm test` before every release.
- Run `npx expo prebuild --platform android --no-install` after widget or native config changes.
- Upload signed APK/AAB artifacts through GitHub Releases after the build completes.

## Android Builds

- Local Gradle builds require a Java runtime and Android SDK.
- EAS preview builds produce installable APKs with the `preview` profile in `eas.json`.
- Production store builds should use the `production` profile and Android App Bundle output.
- Public APK/AAB releases must be signed with a release/upload key, not the Android debug certificate.
- If EAS remote versioning is enabled, sync the remote Android `versionCode` before building a release candidate.

## API Key Safety

- OpenRouter keys are stored locally in app storage.
- Amy JSON exports intentionally clear `openRouterKey`.
- `.easignore` excludes `.env` and generated artifacts from EAS upload.
- See `PRIVACY.md` for the public data and permission disclosure.

## License and Catalogs

- Current source license: PolyForm Noncommercial License 1.0.0.
- This is source-available/non-commercial, not an OSI/FLOSS license.
- Commercial use requires written permission from `kausthubh2007@gmail.com`.
- OpenAPK or IzzyOnDroid-style listings may be possible depending on their current policies and review expectations.
- Official F-Droid main repository distribution requires FLOSS licensing. Amy would need to be relicensed, or distributed through a separate repository, before pursuing official F-Droid main inclusion.
- Third-party dependency, service, and asset notes live in `docs/THIRD_PARTY_NOTICES.md`.

## Future F-Droid-Compatible Prep

- Decide whether to relicense to a recognized FLOSS license before official F-Droid submission.
- Keep all required source code and config in the repository.
- Document non-free network services clearly: OpenRouter is optional and user-supplied; Open Food Facts is used for barcode/product lookup.
- Avoid committing generated native folders unless the distribution process specifically requires them.
- Provide screenshots from `docs/screenshots/`.

See [distribution and community plan](FOSS_DISTRIBUTION_AND_REDDIT_PLAN.md) for the broader OpenAPK, IzzyOnDroid, F-Droid, and community launch sequence.
