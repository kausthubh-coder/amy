# Amy Privacy Notes

Last updated: 2026-06-24

Amy is designed as a local-first Android calorie tracker. It does not require an account, subscription, analytics SDK, Firebase project, advertising SDK, or Google Play Services integration.

## Data Stored On Device

Amy stores app data in local device storage, including:

- diary entries and meal drafts
- saved meals
- calorie and macro goals
- weight logs
- streak repair choices
- settings, including any OpenRouter key you enter
- export folder access metadata on Android

JSON exports remove the saved OpenRouter key and remembered Android export folder URI before writing the export file. Exports can still include diary entries, goals, weight logs, saved meals, notes, and local image URI references.

## Network Services

Amy uses network requests only for features you choose to use:

- Open Food Facts is used for barcode/product lookup.
- OpenRouter is used for AI meal, photo, label, and dictation estimates only after you enter your own key.

When OpenRouter estimates are used, Amy sends the meal text, selected/captured image data for photo or label estimates, and optional context needed for the estimate. If rough location context is enabled, Amy may send a city/region/country label to OpenRouter as part of the estimate prompt.

## Permissions

Amy may request:

- Camera, for barcode scanning and food/label photos.
- Microphone and speech recognition, for dictation.
- Photos/gallery access, when choosing a food or label image.
- Location, only when optional restaurant context is enabled.
- Storage folder access, when saving a JSON export to a user-selected Android folder.

Dictation uses the device speech recognition service available on the device. On many Android devices, that service is provided by Google.

## User Control

You can avoid AI/network estimates by leaving OpenRouter unconfigured and logging manually. You can turn off optional restaurant location context in Settings. You can export your data as JSON from Settings.

## Contact

Questions or privacy concerns: [kausthubh2007@gmail.com](mailto:kausthubh2007@gmail.com)
