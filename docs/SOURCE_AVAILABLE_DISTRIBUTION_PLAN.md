# Amy Source-Available Distribution and Community Plan

Last updated: 2026-06-29

## Goal

Make Amy easy to discover, install, test, and contribute to while staying honest about its current licensing:

- GitHub Releases are the official APK download channel today.
- OpenAPK, IzzyOnDroid-style catalogs, or a separate F-Droid repository may be possible if their current policies accept Amy's source-available/non-commercial license.
- Official F-Droid main is not currently eligible because Amy uses PolyForm Noncommercial License 1.0.0 instead of a FLOSS license.

## Current Public Readiness

Amy already has:

- Public GitHub repo: `https://github.com/kausthubh-coder/amy`
- GitHub Releases download page: `https://github.com/kausthubh-coder/amy/releases/latest`
- Android package: `com.kaust.amy`
- Current source version: `1.0.8`
- Current Android `versionCode`: `10`
- Fastlane metadata in `fastlane/metadata/android/en-US/`
- Screenshots in `docs/screenshots/` and Fastlane phone screenshots
- README, CONTRIBUTING, privacy notes, distribution notes, release process, third-party notices, and a license file
- No ads, no tracking SDKs, no Firebase, and no Play Services dependency in the current source audit
- Local-first diary storage with export/import
- OpenRouter as an optional user-supplied AI service
- Open Food Facts as the only barcode/product database

Current blocker for official F-Droid main:

- Amy is licensed under PolyForm Noncommercial License 1.0.0. That matches the current non-commercial code-protection goal, but it is not a FLOSS license.

## Track 1: GitHub Releases

GitHub Releases remain the easiest official distribution path while Amy is source-available/non-commercial.

Primary release checklist:

1. Update `package.json`, `app.json`, and Fastlane changelog metadata.
2. Run `npm run audit:release`.
3. Run `npm run prebuild:android` for native, widget, permission, or Expo config changes.
4. Build with EAS preview/production signing or a verified local release keystore.
5. Verify APK/AAB package id, versionName, versionCode, signature, supported SDKs, and SHA-256 checksum.
6. Attach the APK to a versioned GitHub Release.
7. Include version, package id, APK filename, signature proof, and checksum in release notes.
8. Link users to `https://github.com/kausthubh-coder/amy/releases/latest`.

The detailed checklist lives in [RELEASE_PROCESS.md](RELEASE_PROCESS.md).

## Track 2: OpenAPK or IzzyOnDroid-Style Catalogs

Before submitting anywhere:

- Confirm the catalog accepts Amy's current non-commercial/source-available license.
- Keep release assets consistent: tag, APK, changelog, checksum, screenshots, and Fastlane metadata.
- Reuse `fastlane/metadata/android/en-US/`.
- Clearly disclose network services:
  - Open Food Facts is used for barcode/product lookup.
  - OpenRouter is optional and requires the user to enter their own key.
  - Device speech recognition may depend on services available on the user's device.

Issue draft:

```text
Title: Add Amy (com.kaust.amy)

Source: https://github.com/kausthubh-coder/amy
APK: https://github.com/kausthubh-coder/amy/releases/latest
License: PolyForm Noncommercial License 1.0.0
Package ID: com.kaust.amy

Amy is an Android-first, local-first calorie tracker built around fast line-by-line meal logging.
It has no ads, no tracking SDKs, no Firebase, and no Play Services dependency.
Diary data stays on device. Open Food Facts powers barcode lookup. Optional OpenRouter estimates require a user-supplied key.
```

## Track 3: Official F-Droid Main

Official F-Droid main requires a recognized FLOSS license and a source-built package. If F-Droid main becomes a priority, choose one of these paths:

1. Relicense Amy under a FLOSS license such as GPL-3.0-or-later, Apache-2.0, or MIT.
2. Keep the current non-commercial license and distribute through a separate repository instead of official F-Droid main.
3. Create a separate FLOSS edition only if contribution ownership, asset rights, and service disclosures make that clean.

Technical prep still needed for official F-Droid main:

- Confirm all app code, assets, and dependencies are compatible with the chosen FLOSS license.
- Keep all required source code and config in the public repository.
- Keep Fastlane changelog files within F-Droid's 500-character guidance.
- Document anti-feature candidates, especially optional OpenRouter and device speech recognition behavior.
- Test a local `fdroiddata` recipe that runs `npm ci`, `npm run prebuild:android`, and Gradle from source.
- Do not rely on EAS binary builds for F-Droid main. F-Droid builds from source and signs the APK.

Current findings are in [FDROID_READINESS_AUDIT.md](FDROID_READINESS_AUDIT.md).

## Track 4: Community Posting

Position Amy as a tester-friendly Android app, not as a finished marketplace product.

Good launch points:

- GitHub Releases
- Android app feedback communities
- Privacy/local-first communities that allow source-available apps
- Catalog-specific communities only when the licensing status is clearly disclosed
- F-Droid/FOSS communities only if the post explicitly says official F-Droid main is blocked until relicensing

Short post outline:

```text
I built Amy, an Android-first calorie tracker where logging feels like writing one food per line.

No auth, no ads, no tracking SDKs, no Firebase, no Play Services dependency.
Diary data stays on device.
Barcode lookup uses Open Food Facts.
AI estimates are optional and require your own OpenRouter key.

APK: https://github.com/kausthubh-coder/amy/releases/latest
Source: https://github.com/kausthubh-coder/amy
License: PolyForm Noncommercial License 1.0.0

I'm looking for install feedback, Android layout issues, widget launcher reports, and source-available distribution feedback.
```

## Recommended Next Steps

1. Keep GitHub Releases as the official user install channel.
2. Use the issue forms to gather device, Android version, APK source, and widget launcher compatibility reports.
3. Keep release tags, Fastlane changelogs, APK filenames, and GitHub Release notes aligned.
4. Decide whether official F-Droid main is worth relicensing for.
5. If relicensing is approved, prepare a dedicated F-Droid branch with license, metadata, anti-feature disclosures, and a tested `fdroiddata` recipe.
