# Amy Distribution Checklist

Last updated: 2026-06-27

## GitHub

- Source repo: `https://github.com/kausthubh-coder/amy`
- Download page: `https://github.com/kausthubh-coder/amy/releases/latest`
- Keep `.env`, APKs, `android/`, `ios/`, `artifacts/`, `builds/`, and raw screenshot dumps out of git.
- Run `npm run audit:release` before every release candidate.
- Run `npm run prebuild:android` after widget, permission, config-plugin, package metadata, or native config changes.
- Upload signed APK/AAB artifacts through GitHub Releases after the build completes.
- Include APK filename, package id, versionName, versionCode, SHA-256 checksum, signing proof, and release notes.

See [RELEASE_PROCESS.md](RELEASE_PROCESS.md) for the full repeatable release checklist.

## Android Builds

- Local Gradle builds require a Java runtime and Android SDK.
- EAS preview builds produce installable APKs with the `preview` profile in `eas.json`.
- Production store builds should use the `production` profile and Android App Bundle output.
- Public APK/AAB releases should be signed with a release/upload key or by EAS, not the Android debug certificate.
- If EAS remote versioning is enabled, sync the remote Android `versionCode` before building a release candidate.
- Build from a clean temp checkout when producing local release artifacts so generated native output stays out of git.

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
- Official F-Droid main repository distribution requires FLOSS licensing. Amy would need to be relicensed before pursuing official F-Droid main inclusion.
- A separate non-main F-Droid repository may be possible under current licensing, but it would not be the official F-Droid main catalog.
- Third-party dependency, service, and asset notes live in `docs/THIRD_PARTY_NOTICES.md`.

## Future F-Droid-Compatible Prep

- Decide whether to relicense to a recognized FLOSS license before official F-Droid submission.
- Keep all required source code and config in the repository.
- Document non-free network services clearly: OpenRouter is optional and user-supplied; Open Food Facts is used for barcode/product lookup.
- Keep Fastlane changelogs under F-Droid's 500-character metadata guidance.
- Test an `fdroiddata` recipe that runs `npm ci`, `npm run prebuild:android`, and Gradle from source.
- Avoid committing generated native folders unless the distribution process specifically requires them.
- Provide screenshots from `fastlane/metadata/android/en-US/images/phoneScreenshots/` and `docs/screenshots/`.

See [F-Droid readiness audit](FDROID_READINESS_AUDIT.md) and [source-available distribution plan](SOURCE_AVAILABLE_DISTRIBUTION_PLAN.md) for the broader OpenAPK, IzzyOnDroid, F-Droid, and community launch sequence.
