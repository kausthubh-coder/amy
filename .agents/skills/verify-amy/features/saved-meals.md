# Saved meals

Repeat meals with fixed numbers, logged by a tap or by typing their name.

## Sub-features

- Create a quick meal from a name and calories (macros use the default split).
- Add logs the meal to the selected day and closes the sheet.
- Typing the exact name (or `2 x name`, `two name`) in the note logs it without the network.
- Delete with Undo.
- "Save as meal" from the edit sheet of any logged food.

## How to get to it (user POV)

Tap the plus button in the dock.

## Driving it with journey.mjs

`node .agents/skills/verify-amy/scripts/journey.mjs saved-meals` does, from an empty diary:

1. Clicks `button "Open saved meals"`, fills `textbox "Meal name"` with `Overnight oats` and `textbox "Calories"` with `320`, clicks `button "Save meal"`. Expects `button "Add Overnight oats, 320 calories"`.
2. Clicks it. Expects the sheet closed, the toast `Logged Overnight oats: 320 cal` and `button "Edit Overnight oats, 320 calories"` in the rail.
3. Types `overnight oats` plus Enter. Expects a second entry at 320 at once and the pill at 640.
4. Reopens the sheet, clicks `button "Delete saved meal Overnight oats"`. Expects the toast `Deleted "Overnight oats"` with Undo and the row gone.

Not scripted: quantities (`2 x overnight oats`) and "Save as meal" from the edit sheet.

## Gotchas

- Tapping the dimmed area closes this sheet (intended); the Settings and edit sheets do not close that way because they hold typed text.
- The sheet's `textbox "Calories"` shares its name with the edit sheet's; only one sheet is open at a time.
- The delete toast shows inside the sheet and, behind the backdrop, at the root, so there are two `Undo` buttons on web; use the one inside `[aria-modal="true"]`.
- The line Add puts in the note has no newline after it. Typing straight on continues that line (and the app treats it as an edit of the same food); press Enter first.
