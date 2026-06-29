# Amy Release Process

Last updated: 2026-06-29

This is the repeatable process for producing public Amy Android releases.

## Release Metadata

Every release should keep these values aligned:

| Surface | File or location | Current value |
| --- | --- | --- |
| App version | `package.json` | `1.0.8` |
| Expo version | `app.json` | `1.0.8` |
| Android `versionCode` | `app.json` | `10` |
| Android package | `app.json` | `com.kaust.amy` |
| Fastlane changelog | `fastlane/metadata/android/en-US/changelogs/10.txt` | versionCode `10` |
| Git tag | Git/GitHub | `v1.0.8` |
| Release channel | GitHub Releases | `https://github.com/kausthubh-coder/amy/releases/latest` |

For a new release:

1. Bump `package.json` version.
2. Bump `app.json` `expo.version`.
3. Increment `app.json` `expo.android.versionCode`.
4. Add `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt`.
5. Keep the changelog concise enough for Android catalog metadata, ideally under 500 characters.
6. Update user-facing docs when install, privacy, permissions, services, or distribution status changes.
7. Commit the source changes.
8. Tag the release commit as `vX.Y.Z`.

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

## Local APK Build

Build local release candidates from a clean temp copy so generated native output and APKs stay out of the source tree:

```sh
BUILD_DIR="$(mktemp -d /private/tmp/amy-v1.0.8-build.XXXXXX)"
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
ANDROID_HOME="$HOME/Library/Android/sdk" \
ANDROID_SDK_ROOT="$HOME/Library/Android/sdk" \
npm run build:local:android
```

The default generated local Gradle release build may use debug signing unless release signing is configured. Do not publish debug-signed APKs as the official user-facing release.

## EAS APK Build

For an EAS preview APK:

```sh
npm run build:preview:android
```

Before using EAS for public releases, confirm:

- EAS remote Android versioning matches `app.json`.
- The build profile outputs the intended APK or AAB type.
- Signing credentials are correct for the release channel.
- Release notes include the EAS build URL or artifact provenance.

## Artifact Verification

After building, verify metadata and checksums before publishing.

Common local checks:

```sh
aapt2 dump badging builds/amy-1.0.8-release.apk
apksigner verify --print-certs builds/amy-1.0.8-release.apk
shasum -a 256 builds/amy-1.0.8-release.apk
```

Record in the release notes:

- APK filename.
- Package id.
- Version name.
- Version code.
- Minimum SDK and target SDK when available.
- SHA-256 checksum.
- Signing certificate summary or EAS signing provenance.
- Known limitations or compatibility notes.

## GitHub Release Checklist

1. Confirm the release commit is on `main`.
2. Confirm `git status --short` is clean except intentionally ignored local artifacts.
3. Create or update tag `vX.Y.Z`.
4. Build and verify the APK/AAB.
5. Draft GitHub Release notes from the Fastlane changelog plus compatibility notes.
6. Upload the APK/AAB.
7. Add SHA-256 checksum to the release body.
8. Smoke test install or upgrade on an emulator or physical Android device.
9. Confirm `https://github.com/kausthubh-coder/amy/releases/latest` points to the expected release.

## F-Droid Builds

Official F-Droid main does not use the GitHub Release APK. F-Droid builds from source and signs the APK itself.

Amy is blocked from official F-Droid main while it remains PolyForm Noncommercial. If Amy is relicensed under a FLOSS license, the F-Droid flow should be:

1. Keep the release commit tagged.
2. Keep Fastlane metadata in the repo.
3. Submit an `fdroiddata` merge request referencing the source repo and tag.
4. Use a build recipe that runs `npm ci`, `npm run prebuild:android`, and Gradle from generated source.
5. Include anti-feature metadata for optional non-free network services if needed.
6. Let F-Droid build and sign the APK.

Read [FDROID_READINESS_AUDIT.md](FDROID_READINESS_AUDIT.md) before attempting this.
