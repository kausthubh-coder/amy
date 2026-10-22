# Editing a logged food

Tapping a line's calories opens the edit sheet: name, serving, calories and macros, portion scaling, re-estimate, save as meal, remove.

## Sub-features

- Manual entry from `+ cal`: name prefilled, calories required, "Log it".
- Editing numbers marks the entry "Your numbers" and remembers them for that line text.
- Portion scaling (servings or grams) rescales macros from the base portion.
- Remove deletes the food and its line, with Undo.
- Enter in any number field saves the sheet.

## How to get to it (user POV)

On Today, tap the calories at the right of a line, or tap `+ cal` on a line without numbers.

## Driving it with journey.mjs

`node .agents/skills/verify-amy/scripts/journey.mjs edit-entry` does, from an empty diary:

1. Types `coffee` plus Enter, clicks `button "Add calories for coffee"`. Expects the `Add calories` sheet; fills `textbox "Calories"` with `5`, clicks `button "Log it"`. Expects the toast `Logged 5 cal. Amy will remember "coffee".` and `button "Edit coffee, 5 calories"`.
2. Clicks that button. Expects the `Edit Food` sheet; fills Calories with `12` and presses Enter. Expects the sheet closed and `button "Edit coffee, 12 calories"`.
3. Types `coffee` plus Enter again. Expects a second `Edit coffee, 12 calories` button at once (remembered, no network) and the pill at 24.
4. Opens the first entry, clicks `button "Remove"`. Expects the toast `Removed coffee` with Undo and one `Edit coffee, 12 calories` left.

Not scripted: portion scaling and "Save as meal" (unit tests in `tests/nutrition.test.ts` cover the scaling math).

## Gotchas

- The sheet keeps your typing if an AI re-estimate lands while it is open; only a different entry id resets the form.
- The Calories field is focused on open when creating; that is intended.
- After the sheet closes, wait for `[aria-modal="true"]` to disappear before typing into the note (the script does).
