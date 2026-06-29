# Amy F-Droid Readiness Audit

Last updated: 2026-06-27

## Verdict

Amy is not ready for official F-Droid main as-is.

The app is technically close to a broad Android public release: it is Android-first, local-first, has no ads or tracking SDKs in the current dependency audit, avoids Firebase and Play Services dependencies, and already has GitHub Releases plus Fastlane metadata.

The blocker is licensing. Amy is currently licensed under PolyForm Noncommercial License 1.0.0, which is source-available/non-commercial, not FLOSS. Official F-Droid main requires apps to be FLOSS and built from published source.

## Official F-Droid Sources Checked

- [Submitting to F-Droid Quick Start Guide](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/)
- [F-Droid Inclusion Policy](https://f-droid.org/en/docs/Inclusion_Policy/)
- [F-Droid Anti-Features](https://f-droid.org/en/docs/Anti-Features/)
- [F-Droid Build Metadata Reference](https://f-droid.org/en/docs/Build_Metadata_Reference/)
- [All About Descriptions, Graphics, and Screenshots](https://f-droid.org/en/docs/All_About_Descriptions_Graphics_and_Screenshots/)

## Readiness Matrix

| Area | Status | Notes |
| --- | --- | --- |
| Public source | Pass | Source is public at `https://github.com/kausthubh-coder/amy`. |
| FLOSS license | Blocked | Current license is PolyForm Noncommercial License 1.0.0. Official F-Droid main needs a recognized FLOSS license. |
| Android package id | Pass | `com.kaust.amy` in `app.json`. |
| Version metadata | Pass | Current source uses version `1.0.8` and Android `versionCode` `10`. |
| Release tags | Pass | `v1.0.8` exists on origin after the current release. Keep every release tag aligned with source metadata. |
| Source build recipe | Partial | `npm run prebuild:android` can generate native Android files; an `fdroiddata` recipe still needs to be tested. |
| Generated native source | Intentional | `android/` is ignored and untracked. F-Droid should regenerate it during the build unless a maintainer chooses to commit generated native output. |
| Signing | Needs release discipline | F-Droid signs official builds itself. GitHub Release APKs should use EAS signing or a release key, not the Android debug certificate. |
| Fastlane metadata | Mostly pass | Title, summary, description, screenshots, and changelogs exist. Changelogs should stay under F-Droid's 500-character guidance. |
| Ads/tracking | Pass in current audit | No Firebase, ads, billing, or tracking SDK dependency was found in current source inspection. |
| Open Food Facts | Disclose | Used for barcode/product lookup. This is the only product nutrition database. |
| OpenRouter | Anti-feature candidate | Optional BYO-key AI estimates use a proprietary network service and should be disclosed as a non-free network service candidate. |
| Device speech recognition | Anti-feature candidate | Dictation depends on speech recognition services available on the device and may be Google-provided on many devices. App remains usable without dictation. |
| Broad Android support | Good baseline | Expo/React Native generated Android currently targets modern SDKs and supports Android 7.0/API 24+ by default. Real install reports should still cover multiple OEMs and launchers. |

## Current App Shape

Amy is a good candidate for broad Android testing because:

- Manual logging works without an account or API key.
- Diary data, saved meals, goals, corrections, imports, exports, and weight logs stay in local app storage.
- JSON exports intentionally omit the saved OpenRouter key.
- Optional services are feature-specific rather than required for the whole app.
- The dependency set is mostly Expo/React Native and permissively licensed at the direct dependency level.
- Android permissions are explainable: camera for photos/barcodes, mic for dictation, location for optional rough context, and vibration for haptics.

Compatibility still needs real-world reports for:

- OEM Android versions from Android 7 through current releases.
- Launchers with different widget resize behavior.
- Devices without Google speech recognition.
- Small screens, large font sizes, and low-memory devices.
- Offline behavior for manual logging, export, and import.

## Blockers Before Official F-Droid Main

1. Choose a FLOSS license if official F-Droid main is the goal.
2. Confirm project assets can be distributed under that license.
3. Confirm contributor licensing for prior and future contributions.
4. Draft and test an `fdroiddata` build recipe from a clean checkout.
5. Document anti-feature metadata for optional OpenRouter and speech recognition behavior.
6. Keep Fastlane metadata and changelog files within F-Droid limits.

Do not submit Amy to official F-Droid main while the project remains PolyForm Noncommercial.

## Practical `fdroiddata` Recipe Outline

This is an outline, not a tested metadata file:

```yaml
Categories:
  - Sports & Health
License: <chosen FLOSS SPDX license>
AuthorName: Amy maintainers
SourceCode: https://github.com/kausthubh-coder/amy
IssueTracker: https://github.com/kausthubh-coder/amy/issues

RepoType: git
Repo: https://github.com/kausthubh-coder/amy.git

Builds:
  - versionName: 1.0.8
    versionCode: 10
    commit: v1.0.8
    sudo:
      - apt-get update
      - apt-get install -y nodejs npm
    init:
      - npm ci
    build:
      - npm run prebuild:android
      - cd android && ./gradlew assembleRelease

AutoUpdateMode: Version
UpdateCheckMode: Tags
CurrentVersion: 1.0.8
CurrentVersionCode: 10
```

The real recipe will need exact F-Droid build-server toolchain decisions, dependency review, Gradle output path configuration, and any required scan ignores or anti-feature metadata.

## Maintainer Decision Needed

There are three honest paths:

1. Keep PolyForm Noncommercial and use GitHub Releases plus source-available-friendly catalogs.
2. Relicense Amy under a FLOSS license and pursue official F-Droid main.
3. Keep the main app non-commercial and create a separate FLOSS edition only if code, assets, services, and contributor rights can be separated cleanly.

Until that decision is made, public docs should describe Amy as source-available, not official F-Droid-ready.
