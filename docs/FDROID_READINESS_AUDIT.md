# Amy Catalog Readiness Audit

Last updated: 2026-08-24

## Verdict

**Target catalog: [IzzyOnDroid](https://izzyondroid.org), not official f-droid.org.**

Amy is now licensed under **GPL-3.0-or-later**. Fastlane metadata includes title, short/full description, changelogs, phone screenshots, `icon.png`, and `featureGraphic.png`. Release Gradle/EAS is wired for per-ABI APKs and fail-closed release signing.

Do **not** submit an `fdroiddata` recipe for official F-Droid main. Barcode scanning keeps `expo-camera` / Google ML Kit (proprietary native libraries such as `libbarhopper_v3.so`). That is compatible with the Izzy binary-repo path and incompatible with F-Droid main's no-proprietary-libs rule. Location (`expo-location`) is also kept.

## IzzyOnDroid Matrix

| Area | Status | Notes |
| --- | --- | --- |
| Public source | Pass | `https://github.com/kausthubh-coder/amy` |
| FLOSS license | Pass | `GPL-3.0-or-later` in `LICENSE` and `package.json`. Third-party packages keep their original licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). |
| Unique application id | Pass | `com.kaust.amy` |
| Fastlane metadata | Pass | `fastlane/metadata/android/en-US/` has title, short/full description, changelogs, screenshots, `images/icon.png` (512×512), and `images/featureGraphic.png` (1024×500). |
| Release signing | Ready, human key still required | Gradle/EAS use `MYAPP_UPLOAD_*` when present and **refuse** release package tasks if they are missing. v1.0.9 GitHub APK was debug-signed (`CN=Android Debug`) and must not be reused. |
| `android:debuggable` / `testOnly` | Pass for release | Release `buildType` sets `debuggable false`. `testOnly` is not set. |
| APK size | Estimated pass after ABI split | v1.0.9 universal APK is **98MB**. Native libs are ~80MB across four ABIs. Arm64-only is ~38MB uncompressed-libs, **~25MB** if native libs are stored compressed (`useLegacyPackaging`). Remaining bulk: Hermes (`libhermesvm.so` ~2.4MB), `libreactnative.so` ~6.5MB, ML Kit barcode (`libbarhopper_v3.so` ~4.7MB plus ~0.8MB models), dex ~10.7MB compressed, JS bundle ~2.9MB. Attach **arm64-v8a** to GitHub Releases. If a measured build exceeds ~30MB, request an Izzy exception with this breakdown. |
| No first-launch phone-home | Pass | Manual logging is local. OpenRouter runs only with a user-supplied key. Open Food Facts runs on barcode lookup. Speech runs when the user taps dictation. |
| Optional AI | Disclosed | OpenRouter is BYO-key. `webSearchEnabled` defaults true **only for those OpenRouter calls**, not at first launch. Fastlane full description discloses this. |
| Official F-Droid main | Not pursued | Kept ML Kit / Play Services barcode stack. No `fdroiddata` recipe in this repo. |

## User-Facing Disclosures

- Local-first diary, no account.
- Open Food Facts for packaged-food barcode lookup (User-Agent contact `https://openamy.app`).
- Optional OpenRouter cloud AI with a user-supplied key; not required for manual logging; may use OpenRouter web search when a key is present.
- Dictation may use the device Google speech service.
- Site: `https://openamy.app`.

## Remaining Human Steps (not done in-repo)

1. Generate a release keystore **offline**. Do not commit it.
2. Set `MYAPP_UPLOAD_STORE_FILE` / `STORE_PASSWORD` / `KEY_ALIAS` / `KEY_PASSWORD`.
3. Build the signed arm64 APK (`npm run build:local:android:arm64` or EAS `production`).
4. Measure the APK size; record SHA-256 and the release cert fingerprint.
5. Tag a new GitHub Release (bump `versionName`/`versionCode` if shipping past v1.0.9) and attach `amy-<version>-arm64-v8a-release.apk`.
6. File https://codeberg.org/IzzyOnDroid/repodata/issues (do not open that issue from this change set).
7. Tell debug-signed v1.0.9 sideload users to export JSON and uninstall before switching keys.

## What Official F-Droid Main Would Still Block

These stay on purpose for Izzy:

- `expo-camera` barcode scanning via Google ML Kit / Play Services native binaries.
- `expo-speech-recognition` may invoke a Google speech service at runtime.
- Optional OpenRouter (non-free network service / Anti-Feature candidate) if F-Droid were ever reconsidered.

Do not strip those to fake F-Droid readiness.

## Size Evidence (v1.0.9 GitHub APK)

| Slice | Compressed size |
| --- | ---: |
| Universal APK | 98.0 MB |
| `lib/x86` | 22.9 MB |
| `lib/x86_64` | 22.1 MB |
| `lib/armeabi-v7a` | 14.1 MB |
| `lib/arm64-v8a` | 20.6 MB |
| dex | 10.7 MB |
| `assets/index.android.bundle` | 2.9 MB |
| Estimated arm64-only, current packaging | 38.1 MB |
| Estimated arm64-only + compressed `.so` | **24.8 MB** |

## Sources

- [IzzyOnDroid App Inclusion Policy](https://izzyondroid.org/docs/general/AppInclusionPolicy/)
- [IzzyOnDroid developer practices (per-ABI APKs)](https://izzyondroid.org/docs/devpractices/)
- [F-Droid Inclusion Policy](https://f-droid.org/en/docs/Inclusion_Policy/) (not the current submission target)
