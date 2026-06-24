# Amy FOSS Distribution and Reddit Plan

Last updated: 2026-06-20

## Goal

Get Amy discoverable in FOSS Android channels without creating trust problems:

- Official F-Droid main repository for source-built distribution.
- Faster GitHub-release based catalogs first, especially OpenAPK and IzzyOnDroid.
- Reddit/community launch posts that ask for testers instead of sounding like ads.

## Current Readiness

Amy already has:

- Public GitHub repo: `https://github.com/kausthubh-coder/amy`
- GitHub release with APK: `v1.0.3`
- Android package: `com.kaust.amy`
- Screenshots in `docs/screenshots/`
- README, CONTRIBUTING, and distribution notes
- No ads, no Play Services, no Firebase, no tracking SDKs
- Local-first data model; OpenRouter key is user supplied and stored locally
- Open Food Facts as the only barcode/product database

Hard blockers before serious FOSS submission:

- Add a real OSI/FLOSS `LICENSE` file. r/FOSSdroid also requires the source license in app posts.
- Add third-party dependency and asset license notes. The app icon/screenshots/assets need explicit redistribution/license status.
- Add Fastlane metadata so F-Droid/Izzy can reuse description, summary, icon, and screenshots.
- Decide how to describe OpenRouter: optional user-supplied non-free/tethered network service, not required for offline/manual use.

## Track 1: Prepare the Repo

1. Choose and commit a license.
   - Recommendation: `GPL-3.0-or-later` if the goal is strong FOSS/copyleft credibility.
   - Alternative: `Apache-2.0` or `MIT` if the goal is permissive adoption.
   - Add `LICENSE` and a README license badge/section.

2. Add metadata files.
   - `fastlane/metadata/android/en-US/title.txt`
   - `fastlane/metadata/android/en-US/short_description.txt`
   - `fastlane/metadata/android/en-US/full_description.txt`
   - `fastlane/metadata/android/en-US/images/phoneScreenshots/*.png`
   - `fastlane/metadata/android/en-US/changelogs/5.txt`

3. Add privacy/disclosure docs.
   - `PRIVACY.md`: local storage, OpenRouter only when key is configured, Open Food Facts lookup, optional rough location context.
   - `docs/THIRD_PARTY_NOTICES.md`: npm dependencies, icon/assets, screenshots.
   - Update README with "Network services" and "F-Droid status" sections.

4. Add release provenance.
   - Keep GitHub releases tagged as `vX.Y.Z`.
   - Attach versioned APKs named like `amy-1.0.3-release.apk`.
   - Add SHA-256 checksums to release notes.

## Track 2: OpenAPK First

OpenAPK is the fastest likely listing because it indexes open-source Android apps and asks developers to open a GitHub issue mentioning the repo.

Submission checklist:

- License file exists.
- GitHub release includes an APK.
- README clearly says Android, FOSS, no ads/tracking, and links latest release.
- Repo topics include: `android`, `expo`, `react-native`, `calorie-tracker`, `open-source`, `foss`, `open-food-facts`.

Issue draft:

```text
Title: Add Amy

Repo: https://github.com/kausthubh-coder/amy
Latest release: https://github.com/kausthubh-coder/amy/releases/latest
Category: Sports & Health or Food
License: <chosen SPDX license>

Amy is a local-first Android calorie tracker built around fast line-based meal logging.
It has no ads, no tracking SDKs, no Firebase, and no Play Services. Diary data stays on device.
Open Food Facts is used for barcode/product lookup. OpenRouter AI estimates are optional and require the user to enter their own key.
```

## Track 3: IzzyOnDroid

IzzyOnDroid is useful before official F-Droid because it consumes developer-signed APKs from GitHub releases and usually updates faster once configured.

Submission checklist:

- Same hard blockers as OpenAPK.
- APK should be under Izzy's current size expectations. Amy `v1.0.3` APK is about 98 MB, which may be a review concern.
- Fastlane metadata is strongly preferred for description and screenshots.
- GitHub releases must remain consistent: tag, APK asset, changelog.

Issue draft:

```text
Title: Add Amy (com.kaust.amy)

Source: https://github.com/kausthubh-coder/amy
Releases/APK: https://github.com/kausthubh-coder/amy/releases/latest
Package ID: com.kaust.amy
License: <chosen SPDX license>

Notes:
- No ads, no tracking SDKs, no Firebase, no Google Play Services.
- Local diary data stays on-device.
- Open Food Facts is used for barcode/product lookup.
- OpenRouter estimates are optional and require a user-supplied key.
- The APK is currently about 98 MB because this is an Expo/React Native release build.
```

## Track 4: Official F-Droid

F-Droid is the highest-trust path but requires more prep because the app must be buildable from public source and pass review.

Expected review points:

- Recognized FLOSS license.
- Build process works from source.
- No proprietary tracking/ad SDKs.
- No undisclosed non-free dependencies or assets.
- Clear anti-feature disclosure for optional OpenRouter network service.
- F-Droid will not provide API keys.

Likely technical work:

1. Make native generation reproducible enough for fdroiddata.
   - F-Droid will need a deterministic build recipe.
   - Expo managed apps can be harder because `android/` is generated and npm/prebuild steps must be scripted.
   - Decide whether to commit `android/` after prebuild or keep a scripted prebuild in metadata.

2. Create an F-Droid-compatible build flavor if needed.
   - Option A: keep OpenRouter configurable but document it as optional.
   - Option B: add `fdroid` build flavor with AI entry points disabled by default.
   - Option C: keep AI UI but require explicit BYO key and make manual logging fully useful offline.

3. Draft fdroiddata metadata.
   - App ID: `com.kaust.amy`
   - Repo: GitHub
   - Builds from tag `v1.0.3` or the next version after prep.
   - Include anti-features only if reviewers require them.

4. Test with fdroidserver.
   - Run `fdroid lint com.kaust.amy`.
   - Run `fdroid build com.kaust.amy`.
   - Fix metadata/build failures before opening the merge request.

5. Open fdroiddata merge request.
   - Commit `metadata/com.kaust.amy.yml`.
   - Label as `New App`.
   - Watch the MR and respond quickly to reviewer questions.

## Track 5: Reddit and Community Posting

Do not post to r/FOSSdroid yet. Their current rules require a source license, and they explicitly say posts should not be AI-written. Use this only as a planning outline; the final Reddit post should be rewritten manually in the user's own voice.

Best order:

1. Add license, privacy doc, third-party notices, Fastlane metadata.
2. Submit OpenAPK and IzzyOnDroid.
3. Once at least one listing or GitHub release is polished, post to r/androidapps self-promotion megathread.
4. Post to r/FOSSdroid only after license is clear and preferably after OpenAPK/Izzy submission is live or pending.
5. If posting to r/FOSSdroid, use flair `Application Release` for a first release or `Development` if asking for testers before listing.

Reddit positioning:

- Ask for feedback on install/build, calorie estimate correction flow, and privacy expectations.
- Lead with local-first, no ads, no tracking.
- Be transparent that OpenRouter is optional BYO key and Open Food Facts is the only barcode database.
- Avoid claims like "privacy perfect" because optional AI/network services exist.
- Do not mention "AI wrote this app" or use generated promotional images.

Human-written post outline:

```text
Title:
I built Amy, a local-first open-source calorie tracker for Android

Body outline:
- I wanted a simple Android calorie tracker where logging feels like writing notes.
- Each line is one meal/food; Amy estimates calories after you finish a line.
- Data stays on-device. No ads, no tracking SDKs, no Firebase, no Play Services.
- Barcode lookup uses Open Food Facts.
- AI estimates are optional and require your own OpenRouter key; manual logging still works without it.
- GitHub: https://github.com/kausthubh-coder/amy
- APK: https://github.com/kausthubh-coder/amy/releases/latest
- License: <chosen SPDX license>
- I’m looking for feedback on Android installs, F-Droid readiness, and whether the optional AI/network-service disclosure feels clear.
```

Short r/androidapps megathread version:

```text
I built Amy, a free/open-source Android calorie tracker focused on fast line-based logging.
No ads/tracking/Firebase/Play Services. Diary data stays on-device.
Barcode lookup uses Open Food Facts; AI estimates are optional with your own OpenRouter key.

GitHub/APK: https://github.com/kausthubh-coder/amy/releases/latest
Source: https://github.com/kausthubh-coder/amy
License: <chosen SPDX license>

I’d appreciate install feedback and thoughts on F-Droid readiness.
```

## Recommended Sequence

1. Add `LICENSE`, `PRIVACY.md`, third-party notices, and Fastlane metadata.
2. Cut `v1.0.4` with those metadata-only changes.
3. Submit OpenAPK issue.
4. Submit IzzyOnDroid issue.
5. Start F-Droid metadata work against `v1.0.4`.
6. Post to Reddit after the repo clearly satisfies FOSS/license expectations.
7. If F-Droid review asks for an AI-free flavor, implement that as `v1.0.5`.

## Source Notes

- F-Droid requires FLOSS licensing, public source/buildability, no proprietary tracking/ad SDKs, and review for anti-features.
- F-Droid recommends reproducible builds for new apps, even though they are not mandatory.
- F-Droid submission goes through fdroiddata metadata, lint/build testing, and a GitLab merge request.
- IzzyOnDroid generally consumes developer-provided APKs from tagged GitHub releases and recommends Fastlane metadata.
- OpenAPK asks developers to open an issue mentioning the repo.
- r/FOSSdroid requires app posts to include the source license and has a rule against AI-written posts/images.
