# Settings and goals

Goals and macro targets, weight logging, the OpenRouter key, location context, export and import.

## Sub-features

- Daily calories between 800 and 10,000; `2,000` reads as two thousand. Save goals persists.
- Logging a weight keeps unsaved edits in the goal fields.
- The OpenRouter key is stored on device; Test key calls OpenRouter (network); Save stores it.
- Export: Download (file) and Copy JSON; exports never contain the key or the Android folder grant.
- Import previews counts, then replaces the diary; an export without a data section is refused; the device's key is kept.

## How to get to it (user POV)

Tap the gear in the top right.

## Driving it with journey.mjs

`node .agents/skills/verify-amy/scripts/journey.mjs settings-goals` does, from an empty diary:

1. Clicks `button "Open settings"`, fills `textbox "Daily calories"` with `2,200`, clicks `button "Save goals"`. Expects the toast `Goals saved.` and `goal.dailyCalories` of 2200 in `@amy/v2/meta`.
2. Fills Daily calories with `2,300` without saving, fills `textbox "Current weight in pounds"` with `180`, clicks `button "Log weight & update goal"`. Expects the toast `Weight logged for Today.`, the Daily calories field still reading `2,300`, and `goal.currentWeightLbs` of 180.
3. Clicks `button "Copy JSON"`. Expects the copied text to parse as an `amy-local-export` whose `settings.openRouterKey` is empty and has no `androidExportDirectoryUri`. (The script records what Amy hands to `navigator.clipboard`.)
4. Clicks `button "Paste JSON"`, fills `textbox "Pasted Amy JSON export"` with `{"kind":"amy-local-export"}`, clicks `button "Import pasted JSON"`. Expects the toast `This file has no Amy data section` and the goal unchanged.

Not scripted: Test key (real network call), Download (a file picker on Android, a browser download on web), a full import (covered by `tests/localDataStore.test.ts`).

## Gotchas

- Test key with a bogus key hits OpenRouter and returns `OpenRouter does not recognize this key.`; that is a real network call.
- The Settings sheet scrolls inside itself; a browser tool must scroll a target into view before clicking it (Playwright does this by itself).
- The daily target outside 800 to 10,000 is refused with an error toast, like onboarding.
