# Security Policy

## Supported Versions

The latest tagged GitHub Release of Amy (`com.kaust.amy`) is the supported version.

## Reporting a Vulnerability

Please do not open public GitHub issues for security or privacy reports.

Email [kausthubh2007@gmail.com](mailto:kausthubh2007@gmail.com) with:

- Amy version name and Android `versionCode`
- Install source (GitHub Releases, IzzyOnDroid, local build, or other)
- A description of the issue and impact
- Steps to reproduce

Do not include OpenRouter keys, full diary exports, or other personal data unless they are required to understand the issue. Strip identifying information first.

We will acknowledge reports and work on a fix for the supported release.

## Release Signing

Public release APKs must be signed with the maintainer release key, not the Android Debug certificate. Existing sideload users who installed a debug-signed APK must uninstall before switching to a release-signed build with the same application id (`com.kaust.amy`). Export a JSON backup from Settings first.

See [docs/RELEASE_PROCESS.md](docs/RELEASE_PROCESS.md).
