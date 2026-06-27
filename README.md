# Amy

Amy is an Android-first calorie tracker for people who want logging to feel like writing a note, not filling out a spreadsheet.

Type one food per line, press Enter, and Amy turns the line into editable calories and macros. Scan packaged foods with Open Food Facts, estimate meals or labels with your own OpenRouter key, and keep your diary data on your device.

<p align="center">
  <a href="https://github.com/kausthubh-coder/amy/releases/latest">
    <img alt="Download Amy APK from GitHub Releases" src="https://img.shields.io/badge/Download%20APK-GitHub%20Releases-111111?style=for-the-badge&logo=github" />
  </a>
  <a href="https://github.com/kausthubh-coder/amy/issues">
    <img alt="Report an issue" src="https://img.shields.io/badge/Report%20Issue-GitHub-3b82f6?style=for-the-badge&logo=github" />
  </a>
  <a href="LICENSE">
    <img alt="License: PolyForm Noncommercial 1.0.0" src="https://img.shields.io/badge/License-Noncommercial-f97316?style=for-the-badge" />
  </a>
</p>

![Amy Today](docs/screenshots/today.png)

## Why Amy

Most calorie apps make you search first and think later. Amy starts from the fastest habit: write down what you ate.

- One line equals one food or meal.
- Estimates stay editable, including servings, calories, carbs, protein, and fat.
- Manual logging works without an account, subscription, or API key.
- Optional AI estimates use a key you enter locally.
- Barcode lookup uses Open Food Facts only.
- Data stays local unless you choose an external lookup or AI estimate.

## Features

| Fast logging | Food capture | Local control |
| --- | --- | --- |
| Line-by-line meal notes | Barcode scans through Open Food Facts | On-device diary storage |
| Enter-to-estimate workflow | Food photo estimates with OpenRouter | JSON export and import |
| Editable nutrition rows | Nutrition label photo estimates | OpenRouter key stored locally |
| Saved meals for repeat foods | Dictation entry | No ads or tracking SDKs |
| Swipe between days | Optional restaurant location context | No auth required |

## Screenshots

| Onboarding | Today | Searching | Logged line | Settings |
| --- | --- | --- | --- | --- |
| ![Onboarding](docs/screenshots/onboarding.png) | ![Today](docs/screenshots/today.png) | ![Searching](docs/screenshots/searching.png) | ![Logged line](docs/screenshots/ai-log.png) | ![Settings](docs/screenshots/settings.png) |

## Download

The installable Android APK is published through GitHub Releases:

[Download the latest APK](https://github.com/kausthubh-coder/amy/releases/latest)

Future distribution targets include easier Android catalog listings such as OpenAPK or IzzyOnDroid, and possibly F-Droid-compatible distribution if the licensing model changes. The current license is non-commercial/source-available, which does not meet the official F-Droid main repository's FLOSS license requirement.

## Privacy

Amy is built around local-first logging:

- Diary entries, saved meals, goals, weight logs, corrections, exports, and imports live in local app storage.
- OpenRouter is optional and only used when you add your own key in Settings.
- Open Food Facts is used for packaged-food barcode lookup.
- Optional rough location context can help restaurant estimates, and can be turned off.
- JSON exports intentionally remove the saved OpenRouter key.

Read [PRIVACY.md](PRIVACY.md) for the full data, permission, and network-service disclosure.

## Run Locally

```sh
npm install
npm test
npm run dev
```

Android release work usually uses a temp Expo prebuild or EAS build so generated native folders and APK artifacts do not need to be committed.

## Contributing

Amy welcomes focused fixes, Android testing, accessibility polish, docs improvements, and careful feature work that keeps logging fast.

Before opening a pull request:

- Keep the product simple: no water tracking, menu scanning, USDA, FatSecret, or second barcode database.
- Preserve the core Today flow: one typed line maps to one editable food or meal.
- Keep user data local and never commit secrets, APKs, native build folders, or raw screenshot dumps.
- Run `npm test`.
- For native/widget changes, also run `npm run prebuild:android`.

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor guide.

## License

Amy is released under the [PolyForm Noncommercial License 1.0.0](LICENSE).

You can use, copy, modify, and share the code for non-commercial purposes. Commercial use, selling the app/code, paid hosted versions, paid forks, or monetized redistribution requires written permission.

Third-party dependency and asset notices live in [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md).

Commercial licensing or permission requests: [kausthubh2007@gmail.com](mailto:kausthubh2007@gmail.com)

## Contact

Questions, collaboration, commercial permission, or distribution help:

[kausthubh2007@gmail.com](mailto:kausthubh2007@gmail.com)
