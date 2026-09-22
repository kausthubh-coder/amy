# Amy Privacy Notes

Last updated: 2026-09-17

Amy is designed as a local-first Android calorie tracker. It does not require an account, subscription, analytics SDK, Firebase project, or advertising SDK.

## Data Stored On Device

Amy stores app data in local device storage, including:

- diary entries and meal drafts
- saved meals
- remembered foods (the calories and macros you confirmed for a log line, reused when you type it again)
- calorie and macro goals
- weight logs
- streak repair choices
- settings, including any OpenRouter key you enter
- export folder access metadata on Android

JSON exports remove the saved OpenRouter key and remembered Android export folder URI before writing the export file. Exports can still include diary entries, goals, weight logs, saved meals, notes, and local image URI references.

## Network Services

Amy uses network requests only for features you choose to use. It does not call cloud AI on first launch.

- Open Food Facts is used for barcode/product lookup.
- OpenRouter is used for AI meal, photo, and label estimates only after you enter your own key. OpenRouter web search is attached only when a line or note mentions a brand, chain, or venue.
- Tapping "Test key" sends the key to OpenRouter's key-info endpoint to check that it works.
- Manual logging works with no API key.

When OpenRouter estimates are used, Amy sends the meal text, downscaled copies of the selected/captured photos for photo or label estimates, and context needed for the estimate: your local time, device locale/region, the other lines already logged that day, and any remembered foods or saved meals that look relevant to the line. If rough location context is enabled, Amy also sends a neighborhood/city/region/country label. Coordinates are never sent.

## Permissions

Amy may request:

- Camera, for barcode scanning and food/label photos. On Android, barcode detection uses Google ML Kit libraries shipped in the APK.
- Microphone and speech recognition, for dictation.
- Photos/gallery access, when choosing a food or label image.
- Approximate (coarse) location, only when optional restaurant context is enabled. Amy does not request precise or background location.
- Storage folder access, when saving a JSON export to a user-selected Android folder.

Dictation uses the device speech recognition service available on the device. On many Android devices, that service is provided by Google.

## User Control

You can avoid AI/network estimates by leaving OpenRouter unconfigured and logging manually; Amy then asks for calories instead of estimating. If saved data ever becomes unreadable, Amy shows a recovery screen where you can copy the raw data before anything is replaced; damaged data is moved aside on the device, not deleted. You can turn off optional restaurant location context in Settings. You can export your data as JSON from Settings.

## Contact

Questions or privacy concerns: [kausthubh2007@gmail.com](mailto:kausthubh2007@gmail.com)
