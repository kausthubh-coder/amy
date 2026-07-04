# Amy Community Outreach Plan

Last updated: 2026-06-29

## Positioning

Use this one-liner:

```text
Amy is an Android calorie tracker where logging feels like writing one food per line.
```

Be precise about licensing:

- Say `source-available` or `source-available/non-commercial` while Amy uses PolyForm Noncommercial License 1.0.0.
- Do not say `FOSS`, `free software`, or `official F-Droid app` unless Amy is relicensed under a recognized FLOSS license and accepted into F-Droid.
- If you say `open source` casually, immediately clarify the current license. Reddit FOSS communities will read "open source" as FLOSS/OSI unless told otherwise.

Lead with what users can test:

- No account.
- No ads or tracking SDKs.
- Local diary storage.
- GitHub APK.
- Open Food Facts barcode lookup.
- Optional OpenRouter estimates with the user's own key.
- Looking for Android install, layout, widget, barcode, import/export, and logging feedback.

Avoid:

- Medical, weight-loss, or nutrition claims.
- Saying calorie estimates are exact.
- Dropping a link without context.
- Replying to every calorie-app thread with the same text.

## Existing App Landscape

There are already credible F-Droid/open nutrition apps. Amy should not position itself as "the first open calorie tracker." The stronger angle is the note-like logging loop.

| App | What it proves | Amy angle |
| --- | --- | --- |
| [Food You](https://f-droid.org/en/packages/com.maksimowiczm.foodyou/) | Material You nutrition tracking, calories/macros/micros, multiple databases. | Amy should feel faster and more diary-like, with one food per line as the primary action. |
| [Waistline](https://f-droid.org/en/packages/com.waist.line/) | Libre calorie counter, weight tracker, local data, Open Food Facts barcode lookup. | Amy should emphasize modern Android polish, widgets, and fast free-text logging. |
| [Energize](https://f-droid.org/en/packages/com.flasskamp.energize/) | Full meal tracking with macro/micronutrients, barcode, targets, backups. | Amy should avoid becoming a dense nutrition dashboard too early. |
| [FitBook](https://f-droid.org/en/packages/com.presley.fit_book/) | Offline calorie tracker with Open Food Facts search and customization. | Amy should stress no-account local logging plus readable note history. |
| [Food-Tracker PFA](https://f-droid.org/en/packages/org.secuso.privacyfriendlyfoodtracker/) | Privacy-friendly calorie tracking with manual food/drink entry and analysis. | Amy's differentiator is the fluid line editor and optional AI estimate layer. |
| [Open Food Facts](https://f-droid.org/en/packages/openfoodfacts.github.scrachx.openfood/) | The open product database and barcode source Amy depends on. | Amy should say it uses Open Food Facts, not that it replaces it. |
| [F-Droid Diet category](https://f-droid.org/en/categories/diet/) | F-Droid already has a diet/nutrition discovery surface. | If Amy becomes FLOSS, this is the likely category. |

## Best Reddit Targets

| Place | Use | Why | Caution |
| --- | --- | --- | --- |
| `r/droidappshowcase` | Primary launch post | The subreddit is explicitly for Android developers to showcase apps and recruit testers. | Still keep it feedback-first and transparent. |
| `r/androidapps` | Recommendation replies only | A recent mod update says all self-promotion, tester requests, app ideas, and feedback requests must go to `r/droidappshowcase`. | Do not create a standalone Amy post there. Reply only when directly useful and rule-compliant. |
| `r/androidapps` recommendation threads | Reply only when directly relevant | Users regularly ask for MyFitnessPal alternatives, no-subscription apps, privacy apps, and simple Android trackers. | One honest reply per thread. Disclose you are the developer. |
| `r/SideProject` | Build-in-public / feedback post | Good for early projects and positioning feedback. | It is less Android-specific; ask for feedback, not downloads. |
| `r/AndroidAppTesting` | Compatibility testing | Useful if you mainly need install/device feedback. | Many users expect Google Play testing links; say clearly that Amy currently distributes APKs through GitHub Releases. |
| `r/fossdroid` | Do not promote yet | It is focused on FOSS Android apps. | Amy is not FOSS while PolyForm Noncommercial is the license. Use only if asking for relicensing/F-Droid advice and do not link as a recommendation. |
| `r/loseit`, `r/CICO`, similar weight communities | Very selective replies only | People ask for calorie-tracking workflows. | These communities can be sensitive around self-promotion and health advice. Do not make launch posts unless rules allow it. |
| `r/androiddev` | Avoid for marketing | Its current rules direct app promotion/recruiting testers elsewhere. | Only use for native Android development questions, not user acquisition. |
| `r/selfhosted` | Weak fit today | Amy is local Android, not a self-hosted app. | Revisit only if Amy gets a companion server or self-hosted AI endpoint story. |

## Specific Threads Found

Check each thread while logged in before replying; Reddit search snippets can show archived or rule-changed threads.

| Thread | Action | Suggested angle |
| --- | --- | --- |
| [`r/androidapps`: Mod Update - Quality Over Quantity](https://www.reddit.com/r/androidapps/comments/1tphf6p/randroidapps_mod_update_quality_over_quantity/) | Follow this rule | It says self-promotion/tester requests belong in `r/droidappshowcase`. Treat this as the current posting rule unless mods change it. |
| [`r/androidapps`: Best alternative app to calculate daily calories](https://www.reddit.com/r/androidapps/comments/1teius6/best_alternative_app_to_calculate_daily_calories/) | Reply if still open | The OP asks for free alternatives without premium subscription. Mention Amy is early, Android-only, source-available, no ads/account, and needs testers. |
| [`r/androidapps`: Self Promotion Megathread](https://www.reddit.com/r/androidapps/comments/1tg63do/self_promotion_megathread/) | Only use if currently allowed | This exists in search, but the newer mod update points developers to `r/droidappshowcase`. Check pinned rules before posting. |
| [`r/droidappshowcase`](https://www.reddit.com/r/droidappshowcase/) | Make a launch post | Best first post. Ask for install, layout, and widget feedback. |
| [`r/SideProject`: How to promote my application](https://www.reddit.com/r/SideProject/comments/1r44wt5/how_to_promote_my_application/) | Learn, not pitch | Good reminder to have a tight one-liner and reply to related discussions before asking for downloads. |
| [`r/fossdroid`: FOSS Calories Tracker](https://www.reddit.com/r/fossdroid/comments/1m1yj0x/foss_calories_tracker/) | Do not pitch Amy unless relicensed | Useful evidence that FOSS Android users want simpler food entry, but Amy is not eligible as a FOSS recommendation today. |
| [`r/fossdroid`: OpenNutriTracker](https://www.reddit.com/r/fossdroid/comments/1mslna9/opennutritracker/) | Do not pitch Amy unless relicensed | Users asked for easier manual foods/custom dishes. This is strong product signal for Amy's note-like logging. |
| [`r/fossdroid`: Track food with FitBook](https://www.reddit.com/r/fossdroid/comments/1e3m9j4/track_food_with_fitbook/) | Learn from the framing | A good example of an application-release post for a real FOSS tracker. Amy should not copy this until the license changes. |
| [`r/loseit`: Privacy respecting calorie tracker app?](https://www.reddit.com/r/loseit/comments/4559dh/privacy_respecting_calorie_tracker_app/) | Archived; do not reply | Product signal: no account and local data are important. |

Monitor these searches weekly:

```text
site:reddit.com/r/androidapps/comments/ "calorie tracker" "subscription" Android
site:reddit.com/r/androidapps/comments/ "MyFitnessPal" "alternative" Android
site:reddit.com/r/androidapps/comments/ "privacy" "calorie tracker" Android
site:reddit.com/r/fossdroid/comments/ "calorie tracker"
site:reddit.com/r/SideProject/comments/ "calorie tracker" app
```

## Draft Launch Post

Title:

```text
I built Amy, an Android calorie tracker where logging feels like writing notes
```

Body:

```text
I built Amy because most calorie apps make logging feel like database work. Amy starts with a plain note-like flow: type one food per line, press Enter, and the line turns into editable calories/macros.

It is Android-first and early. No account, no ads, no tracking SDKs, no Firebase, and no Play Services dependency. Diary data stays local and can be exported/imported as JSON. Barcode lookup uses Open Food Facts. Photo/label/text estimates are optional and use your own OpenRouter key.

Current install is a GitHub APK:
https://github.com/kausthubh-coder/amy/releases/latest

Source:
https://github.com/kausthubh-coder/amy

Important licensing note: it is source-available under PolyForm Noncommercial right now, not official FOSS/F-Droid yet.

I am looking for Android feedback: install failures, small-screen layout bugs, widget resize behavior, barcode misses, import/export issues, and places where logging takes too many taps.
```

## Draft Reply For Recommendation Threads

```text
Dev disclosure: I am building Amy, so treat this as biased, but it fits part of what you asked for.

It is an Android calorie tracker focused on fast note-like logging: one food per line, local diary storage, no account, no ads, no tracking SDKs, and Open Food Facts for barcode lookup. Optional AI estimates use your own OpenRouter key, so manual logging does not require an account or subscription.

It is early and distributed as a GitHub APK right now:
https://github.com/kausthubh-coder/amy/releases/latest

Source is here:
https://github.com/kausthubh-coder/amy

One caveat: it is source-available/non-commercial today, not official FOSS/F-Droid yet.
```

## Draft FOSS/F-Droid Advice Post

Use this only if you want feedback before relicensing:

```text
I am building Amy, an Android calorie tracker with local-first note-like food logging.

Current state: public source, GitHub APK releases, no ads/tracking SDKs/Firebase/Play Services, Open Food Facts barcode lookup, optional user-supplied OpenRouter key for estimates.

Current blocker: the license is PolyForm Noncommercial, so I know it is source-available but not FOSS and not eligible for official F-Droid main.

I am considering whether to relicense under a FLOSS license for official F-Droid submission. For maintainers/users here: what would you want audited before taking a nutrition tracker seriously on F-Droid? Assets, anti-features, source-built recipe, optional network services, anything else?
```

## F-Droid Path

Official F-Droid main is blocked until Amy is relicensed under a recognized FLOSS license.

If you want official F-Droid main:

1. Pick a FLOSS license, such as GPL-3.0-or-later, Apache-2.0, or MIT.
2. Confirm all app code, icons, screenshots, fonts, and other assets can be distributed under compatible terms.
3. Confirm contributor ownership/licensing so relicensing is clean.
4. Keep every public release commit tagged, for example `v1.0.9` for version `1.0.9`.
5. Keep Fastlane metadata in `fastlane/metadata/android/en-US/`, including changelogs named by `versionCode` and kept short enough for F-Droid.
6. Decide whether optional OpenRouter and device speech recognition need F-Droid Anti-Feature metadata.
7. Fork `fdroiddata`, create `metadata/com.kaust.amy.yml`, and describe source, issue tracker, license, categories, build steps, and current version.
8. Test with `fdroid rewritemeta com.kaust.amy`, `fdroid lint com.kaust.amy`, `fdroid checkupdates --allow-dirty com.kaust.amy`, and `fdroid build com.kaust.amy`.
9. Open a merge request against `fdroiddata`.
10. Watch reviewer feedback and answer quickly.

If you do not want to relicense yet:

- Keep GitHub Releases as the official install path.
- Consider a separate F-Droid-compatible repo only if the chosen catalog allows non-commercial/source-available apps.
- Keep saying `source-available`, not `FOSS`.

## Sources

- [F-Droid Inclusion Policy](https://f-droid.org/en/docs/Inclusion_Policy/)
- [F-Droid Submitting to F-Droid Quick Start Guide](https://f-droid.org/en/docs/Submitting_to_F-Droid_Quick_Start_Guide/)
- [F-Droid Anti-Features](https://f-droid.org/en/docs/Anti-Features/)
- [F-Droid App Developers FAQ](https://f-droid.org/en/docs/FAQ_-_App_Developers/)
- [F-Droid Diet category](https://f-droid.org/en/categories/diet/)
- [Waistline on F-Droid](https://f-droid.org/en/packages/com.waist.line/)
- [Food You on F-Droid](https://f-droid.org/en/packages/com.maksimowiczm.foodyou/)
- [Energize on F-Droid](https://f-droid.org/en/packages/com.flasskamp.energize/)
- [FitBook on F-Droid](https://f-droid.org/en/packages/com.presley.fit_book/)
- [`r/androidapps` mod update on self-promotion](https://www.reddit.com/r/androidapps/comments/1tphf6p/randroidapps_mod_update_quality_over_quantity/)
- [`r/droidappshowcase`](https://www.reddit.com/r/droidappshowcase/)
- [`r/fossdroid` subreddit](https://www.reddit.com/r/fossdroid/)
