# Third-Party Notices

Last updated: 2026-06-24

Amy is licensed under the PolyForm Noncommercial License 1.0.0. This file summarizes notable third-party software, services, and assets used by the app.

## Direct App Dependencies

| Package | Version | License |
| --- | ---: | --- |
| `@expo/metro-runtime` | 56.0.15 | MIT |
| `@react-native-async-storage/async-storage` | 2.2.0 | MIT |
| `expo` | 56.0.12 | MIT |
| `expo-camera` | 56.0.8 | MIT |
| `expo-clipboard` | 56.0.x | MIT |
| `expo-file-system` | 56.0.8 | MIT |
| `expo-haptics` | 56.0.3 | MIT |
| `expo-image-picker` | 56.0.18 | MIT |
| `expo-location` | 56.0.18 | MIT |
| `expo-sharing` | 56.0.18 | MIT |
| `expo-speech-recognition` | 56.0.1 | MIT |
| `expo-status-bar` | 56.0.4 | MIT |
| `expo-system-ui` | 56.0.5 | MIT |
| `lucide-react-native` | 1.x | ISC |
| `react` | 19.2.3 | MIT |
| `react-dom` | 19.2.3 | MIT |
| `react-native` | 0.85.3 | MIT |
| `react-native-safe-area-context` | 5.7.0 | MIT |
| `react-native-svg` | 15.15.4 | MIT |
| `react-native-web` | 0.21.2 | MIT |
| `typescript` | 6.0.3 | Apache-2.0 |

The full transitive dependency tree is locked in `package-lock.json`.

## External Services

- Open Food Facts: used for barcode/product lookup.
- OpenRouter: optional BYO-key AI service for meal, food photo, label, and dictation estimates.
- Device speech recognition service: used for dictation when available on the user's device.

## Project Assets

The app icon files in `assets/`, the UI screenshots in `docs/screenshots/`, and the tap sound in `assets/sounds/tap.wav` are project assets distributed with Amy under the project license unless a later notice says otherwise.

Do not reuse Amy branding assets separately from the app without permission.
