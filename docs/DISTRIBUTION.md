# Amy Distribution Checklist

Last updated: 2026-08-24

## GitHub

- Source repo: `https://github.com/kausthubh-coder/amy`
- Site: `https://openamy.app`
- Download page: `https://github.com/kausthubh-coder/amy/releases/latest`
- Keep `.env`, keystores, APKs, `android/`, `ios/`, `artifacts/`, `builds/`, and raw screenshot dumps out of git.
- Run `npm run audit:release` before every release candidate.
- Run `npm run prebuild:android` after widget, permission, config-plugin, package metadata, or native config changes.
- Upload the **signed arm64-v8a** APK through GitHub Releases after the build completes. That file is the IzzyOnDroid artifact.
- Include APK filename, package id, versionName, versionCode, ABI, SHA-256 checksum, signing fingerprint, and release notes.

See [RELEASE_PROCESS.md](RELEASE_PROCESS.md) for the full repeatable release checklist.

## Android Builds

- Local Gradle builds require a Java runtime, Android SDK, and `MYAPP_UPLOAD_*` release signing secrets.
- `npm run build:local:android:arm64` produces the Izzy APK. Release tasks fail if the keystore env is missing; they do not fall back to debug signing.
- EAS `production` builds an APK and picks `*arm64-v8a*.apk`. `production-aab` is optional.
- Public APKs must be signed with the maintainer release key, not `CN=Android Debug`.
- v1.0.9 sideload users must uninstall before switching to the release key. Export JSON first.
- If EAS remote versioning is enabled, sync the remote Android `versionCode` before building a release candidate.
- Build from a clean temp checkout when producing local release artifacts so generated native output stays out of git.

## API Key Safety

- OpenRouter keys are stored locally in app storage.
- Amy JSON exports intentionally clear `openRouterKey`.
- `.easignore` excludes `.env` and generated artifacts from EAS upload.
- See `PRIVACY.md` for the public data and permission disclosure.

## License and Catalogs

- Current source license: GPL-3.0-or-later.
- Intended catalog: IzzyOnDroid (https://izzyondroid.org), via a tagged GitHub Release APK.
- Official f-droid.org is not the current target. Barcode scanning keeps Google ML Kit native libraries.
- Do not open the Izzy Codeberg issue until a release-signed arm64 APK is attached to a tag.
- Third-party dependency, service, and asset notes live in `docs/THIRD_PARTY_NOTICES.md`.

See [catalog readiness audit](FDROID_READINESS_AUDIT.md) and [distribution plan](SOURCE_AVAILABLE_DISTRIBUTION_PLAN.md).
