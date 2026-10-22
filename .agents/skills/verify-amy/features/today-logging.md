# Line logging on Today

The core of Amy: the day's note is one multiline editor, each completed line is a food, and its calories appear in the rail on the right.

## Sub-features

- Enter completes a line. The last line only counts once it is committed (Enter, blur, or leaving the app).
- Inline calories: `latte 190 cal` logs instantly as "Typed calories". Thousands separators work (`big dinner 1,200 cal` is 1200).
- Without an OpenRouter key a completed line shows `+ cal`, which opens the manual sheet.
- A remembered food (one you confirmed before) or a saved meal's exact name logs instantly without the network, with quantities (`2 protein shakes`).
- Deleting a line removes its food with an Undo toast for 8 seconds (20 with a screen reader). Undo appends the line back if you typed more since.
- Fixing a typo keeps the entry; rewriting the line into a different food removes the old entry and starts a new line.
- Swiping left or right changes day (on web, drag horizontally on the editor); the header pill returns to today and exposes previous and next day as accessibility actions.

## How to get to it (user POV)

Open the app past onboarding. Today is the first screen. Tap the note and type.

## Driving it with journey.mjs

`node .agents/skills/verify-amy/scripts/journey.mjs today-logging` does, from an empty diary:

1. Types `protein shake 160 cal`, Enter, `coffee`, Enter into `textbox "Food log for Today"`. Expects `button "Edit protein shake, 160 calories"`, `button "Add calories for coffee"`, the dock pill `button "160 calories logged. Show details"` and `button "1 day streak"`.
2. Replaces the note with `coffee` plus Enter. Expects the toast `Removed protein shake (160 cal)` with `button "Undo"` and the pill at 0.
3. Clicks Undo. Expects the shake line and its 160 cal back, and the note text `protein shake 160 cal` / `coffee`.
4. Reloads. Expects both lines and their calories again, `meta.months` listing the current month and the `@amy/v2/month/<month>` row in localStorage.

Not scripted: the typo-versus-rewrite rule (unit tests in `tests/lines.test.ts` cover it) and the day swipe.

## Gotchas

- Web has no soft keyboard, so the dock never lifts; that behaviour is Android-only.
- With a real OpenRouter key set, completed lines go to the network; keep the key empty in verification runs.
- The dock pill's name changes with the total (`<n> calories logged. Show details`), so wait for the exact number you expect.
