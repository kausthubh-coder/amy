import assert from "node:assert/strict";
import { test } from "node:test";

import { joinShards, migrateWithReport, monthOf, splitIntoShards } from "../src/storage/migrate";

const goodEntry = {
  id: "e1",
  day: "2026-09-17",
  title: "Eggs",
  macros: { calories: 140, carbs: 1, protein: 12, fat: 10 },
  source: "manual",
  confidence: 1,
  createdAt: "2026-09-17T08:00:00Z",
  updatedAt: "2026-09-17T08:00:00Z"
};

test("malformed records are dropped instead of crashing the app later", () => {
  const { data, dropped } = migrateWithReport({
    kind: "amy-local-export",
    data: {
      entries: [goodEntry, { id: "e2", day: "2026-09-17", title: "No macros" }, { id: "e3" }, "junk", null, { ...goodEntry }],
      weightLogs: [
        { id: "w1", day: "2026-09-17", weightLbs: 0 },
        { id: "w2", day: "2026-09-17", weightLbs: "181.5" }
      ],
      goal: { dailyCalories: "abc" },
      settings: { calorieBias: "sideways", locationForRestaurants: "yes" }
    }
  });
  assert.deepEqual(
    data.entries.map((entry) => entry.id),
    ["e1", "e2"]
  );
  assert.deepEqual(data.entries[1]?.macros, { calories: 0, carbs: 0, protein: 0, fat: 0 });
  assert.equal(dropped, 4);
  assert.equal(data.weightLogs.length, 1);
  assert.equal(data.weightLogs[0]?.weightLbs, 181.5);
  assert.equal(data.goal.dailyCalories, 2000);
  assert.equal(data.settings.calorieBias, "balanced");
  assert.equal(data.settings.locationForRestaurants, false);
  assert.deepEqual(data.corrections, []);
});

test("garbage input falls back to a fresh diary", () => {
  assert.equal(migrateWithReport("nope").data.entries.length, 0);
  assert.equal(migrateWithReport(null).data.kind, "amy-local-data");
});

test("month shards round-trip without losing anything", () => {
  const { data } = migrateWithReport({
    entries: [goodEntry, { ...goodEntry, id: "e4", day: "2026-08-02", createdAt: "2026-08-02T08:00:00Z" }],
    dayNotes: [
      { day: "2026-09-17", text: "eggs" },
      { day: "2026-08-02", text: "eggs" },
      { day: "2026-07-01", text: "" }
    ],
    savedMeals: [{ id: "s1", title: "Shake", macros: { calories: 160 } }]
  });
  const { meta, months } = splitIntoShards(data);
  assert.deepEqual(meta.months, ["2026-08", "2026-09"]);
  assert.equal("entries" in meta, false);
  const restored = joinShards(
    JSON.parse(JSON.stringify(meta)),
    Object.values(months).map((month) => JSON.parse(JSON.stringify(month)))
  ).data;
  assert.deepEqual(restored.entries.map((entry) => entry.id).sort(), ["e1", "e4"]);
  assert.equal(restored.dayNotes.length, 2);
  assert.equal(restored.savedMeals[0]?.title, "Shake");
  assert.equal(monthOf("bad"), "undated");
});
