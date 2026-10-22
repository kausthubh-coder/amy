import assert from "node:assert/strict";
import { test } from "node:test";

import { currentStreakDays, totalLoggedDays } from "../src/domain/streaks";
import { FoodEntry } from "../src/domain/types";
import { addDays, dateFromKey, labelForDay, toDateKey } from "../src/utils/date";

function logged(day: string): FoodEntry {
  return { id: `e-${day}-${Math.random()}`, day, title: "Food", servingLabel: "1 serving", macros: { calories: 100, carbs: 0, protein: 0, fat: 0 }, source: "manual", confidence: 1, createdAt: `${day}T12:00:00Z`, updatedAt: `${day}T12:00:00Z` };
}

test("a streak counts back from today and survives until today ends", () => {
  const entries = ["2026-10-20", "2026-10-21", "2026-10-22"].map(logged);
  assert.equal(currentStreakDays(entries, "2026-10-22"), 3);
  // Nothing logged yet today: yesterday's streak still stands.
  assert.equal(currentStreakDays(entries, "2026-10-23"), 3);
  // A whole missed day ends it.
  assert.equal(currentStreakDays(entries, "2026-10-24"), 0);
  assert.equal(currentStreakDays([], "2026-10-22"), 0);
  // Two foods on one day are still one logged day.
  assert.equal(totalLoggedDays([...entries, logged("2026-10-22")]), 3);
});

test("day arithmetic crosses month, year and daylight-saving boundaries", () => {
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-08", 1), "2026-03-09");
  assert.equal(addDays("2026-11-01", 1), "2026-11-02");
  assert.equal(addDays("2026-10-22", -30), "2026-09-22");
  assert.equal(toDateKey(dateFromKey("2026-02-28")), "2026-02-28");
});

test("day labels are relative to today", () => {
  const today = toDateKey(new Date());
  assert.equal(labelForDay(today), "Today");
  assert.equal(labelForDay(addDays(today, -1)), "Yesterday");
  assert.equal(labelForDay(addDays(today, 1)), "Tomorrow");
  assert.match(labelForDay("2020-01-05"), /Jan\.?\s*5|5\s*Jan/);
});
