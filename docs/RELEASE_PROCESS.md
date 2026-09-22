# Amy Release Process

Last updated: 2026-09-22

This is the repeatable process for producing public Amy Android releases, including the **arm64-v8a** APK that IzzyOnDroid should consume.

## Release Metadata

Every release should keep these values aligned:

| Surface | File or location | Current value |
| --- | --- | --- |
| App version | `package.json` | `1.0.11` |
| Expo version | `app.json` | `1.0.11` |
| Android `versionCode` | `app.json` | `12` |
| Android package | `app.json` | `com.kaust.amy` |
| Fastlane changelog | `fastlane/metadata/android/en-US/changelogs/12.txt` | versionCode `12` |
| Git tag | Git/GitHub | `v1.0.11` |
| Release channel | GitHub Releases | `https://github.com/kausthubh-coder/amy/releases/latest` |
| Izzy artifact | GitHub Release asset | `amy-<version>-arm64-v8a-release.apk` |

For a new release:

1. Bump `package.json` version.
2. Bump `app.json` `expo.version`.
3. Increment `app.json` `expo.android.versionCode`.
4. Add `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt`.
5. Keep the changelog concise enough for Android catalog metadata, ideally under 500 characters.
6. Update user-facing docs when install, privacy, permissions, services, or distribution status changes.
7. Commit the source changes.
8. Tag the release commit as `vX.Y.Z`.

v1.0.9 was published as a **debug-signed** universal APK. **1.0.10** is the first public APK that uses the maintainer release key and the arm64 split. EAS remote versioning assigned build 11 to 1.0.10 and will assign build 12 to 1.0.11; `app.json` keeps 12 for local metadata. Keep the APK's actual `versionName` / `versionCode` aligned with the tagged release and Fastlane changelog.

## Standard Verification

Run these before building a release candidate:

```sh
npm ci
npm run audit:release
git diff --check
```

`npm run audit:release` runs:

```sh
npm test
npm run check:deps
npx expo-doctor
```

For native, widget, permission, Expo plugin, or Android metadata changes, also run:

```sh
npm run prebuild:android
```

Generated `android/` and `ios/` folders remain out of git unless a maintainer explicitly asks for them.

## Release Keystore (do this once, offline)

Never commit a keystore, `keystore.properties`, or signing passwords.

Generate a dedicated **release** key (not the Android Debug cert `CN=Android Debug`):

```sh
keytool -genkeypair -v \
  -keystore amy-release.keystore \
  -alias amy \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Keep `amy-release.keystore` offline (encrypted disk or password manager). Losing it means existing Izzy/GitHub users cannot update in place.

Export these in the shell, EAS secrets, or a **non-committed** `~/.gradle/gradle.properties`:

```sh
export MYAPP_UPLOAD_STORE_FILE="/absolute/path/to/amy-release.keystore"
export MYAPP_UPLOAD_STORE_PASSWORD="..."
export MYAPP_UPLOAD_KEY_ALIAS="amy"
export MYAPP_UPLOAD_KEY_PASSWORD="..."
```

If those values are absent, Gradle **refuses** `assembleRelease` / `bundleRelease` rather than silently signing with the debug certificate.

Existing debug-signed sideload users must **uninstall** Amy before installing a release-signed build of `com.kaust.amy`. Ask them to export JSON from Settings first.

## Local APK Build

Build local release candidates from a clean temp copy so generated native output and APKs stay out of the source tree:

```sh
BUILD_DIR="$(mktemp -d /tmp/amy-build.XXXXXX)"
rsync -a --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='android' \
  --exclude='ios' \
  --exclude='builds' \
  --exclude='.expo' \
  --exclude='.env' \
  --exclude='.DS_Store' \
  ./ "$BUILD_DIR/"

cd "$BUILD_DIR"
npm ci
npm run prebuild:android
# MYAPP_UPLOAD_* must already be set
npm run build:local:android:arm64
```

Release prebuild applies ABI splits. Outputs land under:

```text
android/app/build/outputs/apk/release/app-arm64-v8a-release.apk   ← attach this to GitHub Releases for Izzy
android/app/build/outputs/apk/release/app-armeabi-v7a-release.apk
android/app/build/outputs/apk/release/app-x86-release.apk
android/app/build/outputs/apk/release/app-x86_64-release.apk
```

Rename the arm64 file before upload, for example `amy-1.0.11-arm64-v8a-release.apk`. Do not attach the universal/fat APK; v1.0.9 was ~98MB because it embedded every ABI.

`npm run build:local:android` still builds every ABI split. Use `build:local:android:arm64` when you only need the Izzy artifact.

Native libraries are stored compressed in the APK via `packaging.jniLibs.useLegacyPackaging` in `plugins/amy-release.gradle` so the arm64 file stays near Izzy's ~30MB guideline. Do not set `expo.useLegacyPackaging` or `android.bundle.enableUncompressedNativeLibs` in gradle.properties; both map to a Gradle option removed in AGP 8.1. From the v1.0.9 universal APK, arm64-only + compressed `.so` files estimate at **about 25MB**. Hermes, the JS bundle, remaining native libs (including ML Kit barcode / `libbarhopper_v3.so`), and dex still make up that size.

## EAS APK Build

Production EAS is configured to emit an **APK**, not only an AAB, and to pick the arm64 artifact:

```sh
npm run build:production:android
```

That uses the `production` profile in `eas.json` (`buildType: apk`, `applicationArchivePath` matching `*arm64-v8a*.apk`). Store the same release keystore in EAS credentials or inject `MYAPP_UPLOAD_*` as EAS secrets. Preview builds use the same arm64 glob.

`production-aab` remains available if an Android App Bundle is needed later. It is not the Izzy artifact.

Before using EAS for public releases, confirm:

- EAS remote Android versioning matches `app.json` (or bump Fastlane changelog to the remote `versionCode`).
- The downloaded artifact is the arm64 APK, signed with the release key.
- Release notes include the EAS build URL or artifact provenance.

## Artifact Verification

After building, verify metadata and checksums before publishing.

```sh
APK=builds/amy-1.0.11-arm64-v8a-release.apk
aapt2 dump badging "$APK"
apksigner verify --print-certs "$APK"
shasum -a 256 "$APK"
```

Confirm:

- Package id `com.kaust.amy`.
- `native-code: 'arm64-v8a'` only.
- Signer is **not** `CN=Android Debug`.
- `application-debuggable` is absent.
- Size is recorded honestly (Izzy guideline ~30MB per app; request an exception if the arm64 APK is larger).

Record in the release notes:

- APK filename (`amy-<version>-arm64-v8a-release.apk`).
- Package id, version name, version code.
- ABI (`arm64-v8a`).
- Minimum SDK and target SDK when available.
- SHA-256 checksum.
- Signing certificate summary (release key fingerprint, not debug).
- Known limitations or compatibility notes.

## GitHub Release Checklist

1. Confirm the release commit is on `main`.
2. Confirm `git status --short` is clean except intentionally ignored local artifacts.
3. Create or update tag `vX.Y.Z`.
4. Build and verify the **signed arm64** APK.
5. Draft GitHub Release notes from the Fastlane changelog plus compatibility notes.
6. Upload `amy-<version>-arm64-v8a-release.apk` (this is the IzzyOnDroid artifact).
7. Add SHA-256 checksum and signing fingerprint to the release body.
8. Smoke test install or upgrade on an emulator or physical Android device. Debug-signed v1.0.9 users must uninstall first.
9. Confirm `https://github.com/kausthubh-coder/amy/releases/latest` points to the expected release.

## IzzyOnDroid

IzzyOnDroid consumes the GitHub Release APK; it does not rebuild from source the way official F-Droid main does.

After the signed arm64 APK is on a tagged GitHub Release, a maintainer can file:

https://codeberg.org/IzzyOnDroid/repodata/issues

Do not file that issue from this repo change set. Include Fastlane metadata (`fastlane/metadata/android/en-US/`), license `GPL-3.0-or-later`, package `com.kaust.amy`, and the arm64 APK URL.

Official f-droid.org is **not** the current target. Barcode scanning keeps `expo-camera` / ML Kit (proprietary native bits). Do not add an `fdroiddata` recipe unless that policy is explicitly reversed.

Read [FDROID_READINESS_AUDIT.md](FDROID_READINESS_AUDIT.md) for the catalog matrix.
