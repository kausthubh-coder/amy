# Amy privacy notes

Last updated: 2026-10-22

Amy is a local-first Android calorie tracker. It has no account, no subscription, no analytics or crash-reporting SDK, no Firebase project, and no advertising SDK.

## Data stored on the device

Amy keeps its data in its private app storage on the phone:

- diary entries, and for each logged line its source, any barcode, the assumptions an estimate made, and a reference to the photo it came from
- the note text you type on each day's page
- saved meals
- remembered foods (the calories and macros you confirmed for a log line, reused when you type it again)
- calorie and macro goals
- weight logs
- settings, including any OpenRouter key you enter
- the Android folder you chose for exports
- a copy of today's note and calorie totals for the Android home-screen widgets

The OpenRouter key is stored unencrypted inside Amy's private storage. Other apps cannot read that storage on a normal (unrooted) phone.

If Android backup is turned on for your Google account, Android may include Amy's private storage, including the key and the diary, in the device backup. Amy does not opt out of this.

Photos you pick or take for an estimate are copied into Amy's cache folder by the image picker and referenced from the diary entry. Amy does not delete them.

JSON exports remove the saved OpenRouter key and the Android export folder before writing the file. Exports still include diary entries, day notes, goals, weight logs, saved meals, remembered foods, and local photo paths.

## Network services

Amy makes network requests only for features you choose to use. It does not call any cloud service on first launch.

- Open Food Facts is used for barcode lookup. The request carries the barcode and an app name with a link to openamy.app.
- OpenRouter is used for AI meal, photo, and label estimates only after you enter your own key. Requests are labelled with the app name, so they show up as Amy in your OpenRouter activity.
- Tapping "Test key" sends the key to OpenRouter's key-info endpoint to check that it works.
- Manual logging works with no API key.

When OpenRouter estimates are used, Amy sends the meal text, downscaled and re-encoded copies of the selected photos for photo or label estimates (camera metadata such as location tags is not included), and the context the estimate needs: your local time, device locale and region, the other lines already logged that day with their calories, and any remembered foods or saved meals that look relevant to the line. If rough location context is enabled, Amy also sends a neighborhood/city/region/country label.

OpenRouter web search is attached only when a line or note mentions a brand, chain, or venue. It runs through OpenRouter's search tool, which uses the model provider's own search (Google Search for the default Gemini models) or Exa. That provider sees the search queries the model builds from your line.

Coordinates are never sent to OpenRouter. To turn a location fix into a place name, Amy uses Android's geocoder. On phones with Google Play services, that geocoder and the location fix itself are Google services, so the approximate coordinates go to Google. Phones without a geocoder skip location context.

## Permissions

Amy may request:

- Camera, for barcode scanning and food or label photos. On Android, barcode detection uses Google ML Kit libraries shipped in the APK. ML Kit is closed-source Google code; Google's ML Kit terms say it may contact Google servers and report usage metrics while it runs.
- Microphone and speech recognition, for dictation.
- Photos or gallery access, when choosing a food or label image.
- Approximate (coarse) location, only when optional restaurant context is enabled. Amy does not request precise or background location.
- Storage folder access, when saving a JSON export to an Android folder you pick.

Dictation hands your microphone audio to the phone's speech service, which is Google's on most Android phones. That service may send the audio to Google's servers to transcribe it. Amy only receives the text and does not request on-device-only recognition.

Links of the form `amy://...` (the home-screen widgets use them) can open Amy, prefill a line, look up a barcode, or start dictation. They cannot log food by themselves: typed text waits for Enter, a barcode waits for your confirmation, and dictation only logs what you say.

## Your control

Leave OpenRouter unconfigured to avoid AI and network estimates. Amy then asks for calories instead of estimating. Turn off restaurant location context in Settings at any time.

Export your data as JSON from Settings. "Download" writes the file to a folder you choose. "Copy JSON" puts your whole diary on the clipboard, which other apps you open can read and some phones sync to other devices, so prefer Download.

If saved data ever becomes unreadable, Amy shows a recovery screen where you can copy the raw data, minus the OpenRouter key, to the clipboard before anything is replaced. Damaged data is moved aside on the device, not deleted.

## Contact

Questions or privacy concerns: [kausthubh2007@gmail.com](mailto:kausthubh2007@gmail.com)
