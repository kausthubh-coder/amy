# Third-Party Notices

Last updated: 2026-08-24

Amy's own original source and original project assets are licensed under **GPL-3.0-or-later**. See [LICENSE](../LICENSE).

This file does **not** relicense third-party software. Dependencies, runtime services, and bundled native binaries keep their upstream licenses. MIT, Apache-2.0, ISC, and similar permissive licenses used by direct npm dependencies are generally GPL-compatible; they are not converted into GPL.

## Direct App Dependencies

| Package | Version | License |
| --- | ---: | --- |
| `@expo/metro-runtime` | 56.x | MIT |
| `@react-native-async-storage/async-storage` | 2.2.0 | MIT |
| `expo` | 56.x | MIT |
| `expo-camera` | 56.x | MIT (pulls proprietary Google ML Kit native bits on Android; see below) |
| `expo-clipboard` | 56.x | MIT |
| `expo-file-system` | 56.x | MIT |
| `expo-haptics` | 56.x | MIT |
| `expo-image-picker` | 56.x | MIT |
| `expo-location` | 56.x | MIT |
| `expo-sharing` | 56.x | MIT |
| `expo-speech-recognition` | 56.x | MIT |
| `expo-status-bar` | 56.x | MIT |
| `expo-system-ui` | 56.x | MIT |
| `lucide-react-native` | 1.x | ISC |
| `react` | 19.2.3 | MIT |
| `react-dom` | 19.2.3 | MIT |
| `react-native` | 0.85.3 | MIT |
| `react-native-safe-area-context` | 5.7.0 | MIT |
| `react-native-svg` | 15.15.4 | MIT |
| `react-native-web` | 0.21.2 | MIT |
| `typescript` | 6.0.3 | Apache-2.0 |

The full transitive dependency tree is locked in `package-lock.json`.

## Proprietary native components kept on purpose

Android barcode scanning uses Google ML Kit via `expo-camera`. The v1.0.9 APK ships non-free native libraries and models, including:

- `libbarhopper_v3.so`
- `assets/mlkit_barcode_models/*.tflite`

Those files are **not** GPL'd. They remain Google's binaries. Official f-droid.org is not the current distribution target because of this stack. IzzyOnDroid is.

`expo-location` is also kept.

## External Services

- Open Food Facts: barcode/product lookup. Product data is an external database (typically ODbL), not shipped as Amy source.
- OpenRouter: optional BYO-key AI for meal, photo, label, and dictation estimates. Not required for manual logging. When a key is configured, requests may enable OpenRouter web search. Amy does not call OpenRouter on first launch.
- Device speech recognition: used for dictation when available. On many Android devices this is a Google service at runtime; that service is not part of Amy's GPL source.

## Project Assets

Original Amy-authored assets (app icon files in `assets/`, Fastlane `icon.png` / `featureGraphic.png` derived from them, UI screenshots in `docs/screenshots/` and Fastlane phone screenshots, and `assets/sounds/tap.wav`) are distributed under GPL-3.0-or-later unless a later notice says otherwise.

Do not reuse Amy branding as a standalone trademark/logo set in a way that implies a different app is Amy.
