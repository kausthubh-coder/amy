# Amy Distribution and Community Plan

Last updated: 2026-08-24

## Goal

Make Amy easy to discover, install, test, and contribute to, with an honest FLOSS + IzzyOnDroid path:

- GitHub Releases are the official APK download channel.
- **IzzyOnDroid** is the intended F-Droid-compatible catalog (https://izzyondroid.org), not official f-droid.org.
- Amy is licensed under GPL-3.0-or-later.

## Current Public Readiness

Amy already has:

- Public GitHub repo: `https://github.com/kausthubh-coder/amy`
- Site: `https://openamy.app`
- GitHub Releases download page: `https://github.com/kausthubh-coder/amy/releases/latest`
- Android package: `com.kaust.amy`
- Current source version: `1.0.9`
- Current Android `versionCode`: `11`
- Fastlane metadata in `fastlane/metadata/android/en-US/` including icon and feature graphic
- Screenshots in `docs/screenshots/` and Fastlane phone screenshots
- README, CONTRIBUTING, SECURITY.md, privacy notes, distribution notes, release process, third-party notices, and GPL-3.0-or-later
- No ads, no tracking SDKs, no Firebase
- Local-first diary storage with export/import
- OpenRouter as an optional user-supplied AI service (not used on first launch)
- Open Food Facts as the only barcode/product database
- Per-ABI release APKs with arm64-v8a as the Izzy artifact
- Fail-closed release signing from `MYAPP_UPLOAD_*` secrets

Remaining before filing Izzy:

- Create a release keystore offline (never commit it).
- Build and attach a **release-signed** arm64 APK to a tagged GitHub Release.
- v1.0.9 was debug-signed; existing sideload users must uninstall to switch keys.

Official f-droid.org remains out of scope while `expo-camera` / ML Kit barcode native libs stay in the app.

## Track 1: GitHub Releases

Primary release checklist:

1. Update `package.json`, `app.json`, and Fastlane changelog metadata.
2. Run `npm run audit:release`.
3. Run `npm run prebuild:android` for native, widget, permission, or Expo config changes.
4. Build with EAS `production` or local `npm run build:local:android:arm64` using the release keystore.
5. Verify APK package id, versionName, versionCode, **arm64-v8a**, signature (not Android Debug), SDKs, and SHA-256 checksum.
6. Attach `amy-<version>-arm64-v8a-release.apk` to a versioned GitHub Release.
7. Include version, package id, APK filename, ABI, signature proof, and checksum in release notes.
8. Link users to `https://github.com/kausthubh-coder/amy/releases/latest`.

The detailed checklist lives in [RELEASE_PROCESS.md](RELEASE_PROCESS.md).

## Track 2: IzzyOnDroid

After the signed arm64 APK is on a tagged GitHub Release, file:

https://codeberg.org/IzzyOnDroid/repodata/issues

Do not file that issue until the artifact exists. Fastlane in this repo is the listing copy.

Disclose in the request:

- Open Food Facts is used for barcode/product lookup.
- OpenRouter is optional and requires the user to enter their own key; it is not required for manual logging; web search may run on those AI calls only.
- Device speech recognition may depend on Google services available on the user's device.
- Barcode scanning uses Google ML Kit native libraries (kept on purpose).
- Package ID: `com.kaust.amy`
- License: GPL-3.0-or-later
- APK: arm64-v8a release-signed GitHub Release asset

## Track 3: Official f-droid.org (not current)

Do not add an `fdroiddata` recipe. F-Droid main would reject the ML Kit barcode binaries. Revisit only if a maintainer decides to ship a separate fully-FLOSS barcode stack.

Current findings are in [FDROID_READINESS_AUDIT.md](FDROID_READINESS_AUDIT.md).

## Track 4: Community Posting

Position Amy as a tester-friendly Android app.

Good launch points:

- GitHub Releases
- Android app feedback communities
- FOSS Android communities once the Izzy APK is live (license is now GPL)
- Catalog-specific communities with the Izzy/GitHub install path spelled out

Short post outline:

```text
I built Amy, an Android-first calorie tracker where logging feels like writing one food per line.

No auth, no ads, no tracking SDKs.
Diary data stays on device.
Barcode lookup uses Open Food Facts.
AI estimates are optional and require your own OpenRouter key.

APK: https://github.com/kausthubh-coder/amy/releases/latest
Source: https://github.com/kausthubh-coder/amy
License: GPL-3.0-or-later

I'm looking for install feedback, Android layout issues, and widget launcher reports.
```

The detailed Reddit/community playbook lives in [COMMUNITY_OUTREACH.md](COMMUNITY_OUTREACH.md).

## Recommended Next Steps

1. Create the release keystore offline and keep it off git.
2. Ship a signed arm64 APK on a new tagged GitHub Release.
3. File the IzzyOnDroid inclusion issue.
4. Keep GitHub Releases as the fallback install channel.
5. Use the issue forms to gather device and widget compatibility reports.
