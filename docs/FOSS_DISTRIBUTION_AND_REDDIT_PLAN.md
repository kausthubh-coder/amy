# Amy Source-Available Distribution and Community Plan

Last updated: 2026-06-24

## Goal

Make Amy easy to discover and install while staying honest about its current licensing:

- GitHub Releases are the primary APK download channel.
- OpenAPK and IzzyOnDroid-style catalogs are possible future targets, subject to their current source/license policies.
- Official F-Droid main repository submission is not currently eligible because Amy uses a non-commercial/source-available license.

## Current Readiness

Amy already has:

- Public GitHub repo: `https://github.com/kausthubh-coder/amy`
- GitHub Releases download page: `https://github.com/kausthubh-coder/amy/releases/latest`
- Android package: `com.kaust.amy`
- Screenshots in `docs/screenshots/`
- README, CONTRIBUTING, distribution notes, Fastlane metadata, privacy notes, third-party notices, and a LICENSE file
- No ads, no tracking SDKs, no Firebase, and no Play Services
- Local-first data model
- OpenRouter as an optional user-supplied AI service
- Open Food Facts as the only barcode/product database

Current blocker for official F-Droid main:

- Amy is licensed under PolyForm Noncommercial License 1.0.0. That matches the non-commercial code-protection goal, but it is not a FLOSS license.

## Track 1: GitHub Releases

Primary release checklist:

1. Run `npm test`.
2. Run `npm run check:deps`.
3. Run `npx expo-doctor`.
4. Sync EAS remote Android versioning if using EAS.
5. Build with EAS preview/production signing or a verified local release keystore.
6. Verify the APK/AAB metadata and signature.
7. Attach the APK to a versioned GitHub Release.
8. Include version, package ID, APK filename, and SHA-256 checksum in release notes.
9. Link users to `https://github.com/kausthubh-coder/amy/releases/latest`.

## Track 2: OpenAPK or IzzyOnDroid

Before submitting anywhere:

- Confirm the catalog accepts Amy's current non-commercial/source-available license.
- Keep release assets consistent: tag, APK, changelog, and checksum.
- Reuse the Fastlane metadata in `fastlane/metadata/android/en-US/`.
- Clearly disclose network services:
  - Open Food Facts is used for barcode/product lookup.
  - OpenRouter is optional and requires the user to enter their own key.

Issue draft:

```text
Title: Add Amy (com.kaust.amy)

Source: https://github.com/kausthubh-coder/amy
APK: https://github.com/kausthubh-coder/amy/releases/latest
License: PolyForm Noncommercial License 1.0.0
Package ID: com.kaust.amy

Amy is an Android-first, local-first calorie tracker built around fast line-by-line meal logging.
It has no ads, no tracking SDKs, no Firebase, and no Play Services.
Diary data stays on device. Open Food Facts powers barcode lookup. Optional OpenRouter estimates require a user-supplied key.
```

## Track 3: F-Droid-Compatible Path

Official F-Droid main requires a recognized FLOSS license. If F-Droid main becomes a priority, choose one of these paths:

1. Relicense the app under a FLOSS license such as GPL-3.0-or-later, Apache-2.0, or MIT.
2. Keep the current non-commercial license and distribute through a separate F-Droid repository instead of the official main repo.
3. Create a separate FLOSS edition only if contribution ownership and asset rights make that clean.

Technical prep still needed for any official F-Droid-compatible path:

- Document the optional OpenRouter network service and BYO-key requirement.
- Decide whether generated `android/` should be committed or recreated through a deterministic build recipe.
- Test an fdroiddata build recipe before submitting.

## Track 4: Community Posting

Position Amy as a tester-friendly Android app, not as a finished marketplace product.

Good launch points:

- GitHub Releases
- Android app feedback communities
- Privacy/local-first communities that allow source-available apps
- F-Droid/FOSS communities only if the license situation is clearly disclosed

Short post outline:

```text
I built Amy, an Android-first calorie tracker where logging feels like writing one food per line.

No auth, no ads, no tracking SDKs, no Firebase, no Play Services.
Diary data stays on device.
Barcode lookup uses Open Food Facts.
AI estimates are optional and require your own OpenRouter key.

APK: https://github.com/kausthubh-coder/amy/releases/latest
Source: https://github.com/kausthubh-coder/amy
License: PolyForm Noncommercial License 1.0.0

I'm looking for install feedback, Android layout issues, and thoughts on distribution.
```

## Recommended Next Steps

1. Sync EAS remote Android versionCode to the current published APK lineage.
2. Build a signed `v1.0.5` APK/AAB.
3. Verify signature, package ID, versionName, versionCode, target SDK, and checksum.
4. Publish the updated README, LICENSE, privacy doc, notices, and Fastlane metadata.
5. Confirm which catalogs accept non-commercial/source-available apps.
6. Decide later whether official F-Droid main is worth relicensing for.
