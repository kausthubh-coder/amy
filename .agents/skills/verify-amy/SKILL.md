---
name: verify-amy
description: Run Amy (the Expo calorie tracker) as Expo web and prove a change by driving the real UI, with a scripted journey per feature or by hand with a browser tool. Use after any change to screens, line pairing, storage, settings, or saved meals, and before saying a change works.
---

# Verify Amy

Amy is an Android app, but there is no device or emulator here. Expo web runs the same React code against the same storage and line-pairing logic, so it proves the logging flow, sheets, settings and persistence. It cannot prove camera, dictation, widgets, the soft keyboard, haptics, the splash, or anything in `plugins/`. Say which of those your change touches and that they stay unverified.

## Launch

```sh
sh .agents/skills/verify-amy/scripts/web.sh start
```

Starts Metro for web on port 19077 (override with `AMY_WEB_PORT`), writes the pid to `.artifacts/verify/.run/pid`, waits until `http://localhost:19077/` answers and the first bundle has built (20 to 40 s). Ready means the script prints `ready:`. On Windows the pid is the Windows pid of the shell that runs node; `stop` kills that tree. Edits to `src/` reload in the browser without a restart.

## Doctor

```sh
sh .agents/skills/verify-amy/scripts/web.sh doctor
```

Read-only. Passes when the pid you started is alive, the page answers, and the bundle builds. Run it first whenever the browser shows a blank page or a timeout; if it fails, read `.artifacts/verify/.run/web.log` before anything else.

## Drive

```sh
node .agents/skills/verify-amy/scripts/journey.mjs                      # every journey
node .agents/skills/verify-amy/scripts/journey.mjs today-logging edit-entry
```

Each journey starts from an empty diary (its own browser context, so no person's profile is touched), finishes onboarding through the screens, then drives one feature the way a person does and checks the observable end state, including storage. Journeys: `onboarding`, `today-logging`, `edit-entry`, `saved-meals`, `settings-goals`; `features/` says what each one proves. The script runs the installed Chrome or Edge headless through Playwright, which it installs into `.artifacts/verify/.tools` on first use (about 10 MB, no browser download). `AMY_HEADED=1` shows the browser. It prints `PASS <journey>` or `FAIL <journey>: <what was expected>` and exits 1 on any failure.

A change the journeys do not cover gets a new step in the matching journey (or a new journey) before you call it verified; the feature file in `features/` changes in the same commit. For a one-off look, drive by hand with any browser tool (in T3 Code: `preview_open` on `localhost:19077`, `preview_resize` to the `pixel-7` preset, then `preview_type`, `preview_click`, `preview_evaluate`). If that tool's snapshots time out, the script is the reliable path. Target elements by their accessible names, which are stable:

| What | Locator |
| --- | --- |
| Onboarding, step 1 | `role=button[name='Continue']` |
| Onboarding, step 2 | `role=button[name='Skip for now']` or `role=button[name='Start']` |
| The day's note (the editor) | `role=textbox[name='Food log for Today']` (or `Food log for Yesterday`) |
| A logged line's calories | `role=button[name='Edit <food>, <n> calories']` |
| A line waiting for calories | `role=button[name='Add calories for <line>']` |
| Dock | `role=button[name='<n> calories logged. Show details']`, `role=button[name='Open settings']`, `role=button[name='Open saved meals']`, `role=button[name='Scan barcode']` |
| Edit sheet | `role=textbox[name='Calories']`, `role=button[name='Save']`, `role=button[name='Log it']`, `role=button[name='Remove']` |
| Settings | `role=textbox[name='Daily calories']`, `role=button[name='Save goals']`, `role=textbox[name='Current weight in pounds']`, `role=button[name='Log weight & update goal']`, `role=button[name='Copy JSON']`, `role=button[name='Paste JSON']`, `role=textbox[name='Pasted Amy JSON export']`, `role=button[name='Import pasted JSON']` |
| Saved meals | `role=textbox[name='Meal name']`, `role=textbox[name='Calories']`, `role=button[name='Save meal']`, `role=button[name='Add <meal>, <n> calories']`, `role=button[name='Delete saved meal <meal>']` |
| Toast | the message as text, `role=button[name='Undo']`; a toast raised inside a sheet also renders at the root behind the backdrop, so scope it to the `[aria-modal="true"]` element |
| Any sheet | `role=button[name='Close <title>']`; while open it is the `[aria-modal="true"]` element |

Typing into the note with a trailing newline completes the line (`"coffee\n"`). Without an OpenRouter key every completed line shows `+ cal`; a line with inline calories (`latte 190 cal`) logs at once; a remembered food or a saved meal's exact name logs at once. Keep the key empty so nothing leaves the browser. After a sheet closes, wait until no `[aria-modal="true"]` element is left (about 300 ms) before typing into the note; keystrokes sent during the slide-out go to the sheet's focus trap and vanish. A line Amy appended itself (a saved meal, a barcode) ends without a newline, like any note, so press Enter before typing the next line or the two merge into one.

## Evidence

Each script run writes `.artifacts/verify/<YYYYMMDD-HHMM>-<journeys>/` (ignored by git): `run.md` with the steps, the HEAD commit and PASS or FAIL per journey, and per journey `NN-<label>.png` (the screen after an action) with `NN-<label>.txt` (the accessibility tree at that moment, including an open sheet). A failure adds `NN-failure.png` and `.txt`. Storage checks (the goal, the month shard, the export without the key) are assertions inside the journeys; their outcome is in `run.md`.

A manual drive gets the same folder, filled by hand: a screenshot after the action and one of the resulting state, the accessibility tree pasted into `state.txt`, and for a persistence claim the storage check (`Object.keys(localStorage).filter(k => k.startsWith('@amy/'))` and `localStorage.getItem('@amy/v2/meta')` through the browser tool's evaluate).

Standards: drive the real path a person takes (the editor, the sheets), never internal setters or test-only hooks. Capture the action and the state it produced, not only the final screen. A claim about saving needs the storage check. The only test doubles are the OpenRouter fetch in unit tests and, in the `settings-goals` journey, the browser clipboard (the script records what Amy hands to `navigator.clipboard`, which is the system boundary).

## Cleanup

```sh
sh .agents/skills/verify-amy/scripts/web.sh stop
```

Kills the pid the script started (never by port or process name) and clears `.artifacts/verify/.run/pid`. Evidence folders stay. The journeys clear only their own browser context; to reset a diary you drove by hand, run `localStorage.clear()` through the browser tool and reload. Never clear a browser profile a person uses.

## Helpers

- `scripts/web.sh start | doctor | stop`: the Metro instance, as above. Plain POSIX sh; runs in Git Bash on Windows and in any shell on macOS or Linux.
- `scripts/journey.mjs [journey ...]`: the scripted drives, as above. Needs node 20+ and a running server.
