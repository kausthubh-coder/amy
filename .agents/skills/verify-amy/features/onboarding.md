# Onboarding

Two steps on first launch: the daily calorie target (weights optional), then the optional OpenRouter key.

## Sub-features

- The target must be 800 to 10,000, with an inline error otherwise.
- Macro targets preview as you type the calories.
- Step 2 shows the model field, Test key and the location switch only once a key is typed.
- Skip for now leaves the key empty and opens Today.

## How to get to it (user POV)

First launch, or after Start fresh on the recovery screen. On web, `localStorage.clear()` and a reload bring it back.

## Driving it with journey.mjs

`node .agents/skills/verify-amy/scripts/journey.mjs onboarding` does:

1. Clears storage and reloads. Expects the text `Set your target` and `textbox "Daily calorie target"` holding `2000`.
2. Fills `500`, clicks `button "Continue"`. Expects the error `Enter a daily calorie target between 800 and 10,000.` and no step change.
3. Fills `2200`, clicks Continue. Expects `Smart estimates` and `button "Skip for now"`.
4. Clicks Skip for now. Expects `textbox "Food log for Today"` and the dock pill `button "0 calories logged. Show details"`.
5. Expects `goal.dailyCalories` of 2200 in `@amy/v2/meta`.

Every other journey runs steps 1, 3 and 4 with the default target first.

## Gotchas

- Current and goal weight are optional; leaving them empty must not block Continue.
- The key step is skipped in every journey, so no request ever leaves the browser.
