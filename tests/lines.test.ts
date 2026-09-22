import assert from "node:assert/strict";
import { test } from "node:test";

import { buildLineRows, entriesWithoutLines, isLoggableLine, parseInlineCalories, sanitizePrefill, singleLineEdit } from "../src/domain/lines";
import { FoodEntry } from "../src/domain/types";

function entry(id: string, rawInput: string, createdAt: string): FoodEntry {
  return {
    id,
    day: "2026-09-17",
    rawInput,
    title: rawInput,
    servingLabel: "1 serving",
    macros: { calories: 100, carbs: 10, protein: 5, fat: 2 },
    source: "manual",
    confidence: 1,
    createdAt,
    updatedAt: createdAt
  };
}

test("duplicate lines each get their own entry, oldest first", () => {
  const entries = [entry("b", "Coffee", "2026-09-17T09:00:00Z"), entry("a", "coffee", "2026-09-17T08:00:00Z")];
  const rows = buildLineRows("coffee\ntoast\ncoffee\n", entries, {});
  assert.equal(rows[0]?.entry?.id, "a");
  assert.equal(rows[1]?.entry, undefined);
  assert.equal(rows[2]?.entry?.id, "b");
});

test("the last line only completes when committed", () => {
  assert.equal(buildLineRows("eggs", [], {})[0]?.completed, false);
  assert.equal(buildLineRows("eggs", [], {}, true)[0]?.completed, true);
  assert.equal(buildLineRows("eggs\n", [], {})[0]?.completed, true);
});

test("short foods are loggable, numbers and blanks are not", () => {
  assert.equal(isLoggableLine("egg"), true);
  assert.equal(isLoggableLine("pho"), true);
  assert.equal(isLoggableLine("12"), false);
  assert.equal(isLoggableLine(" a "), false);
});

test("editing one line in place is detected so its entry survives", () => {
  assert.deepEqual(singleLineEdit("turky sandwich\napple", "turkey sandwich\napple"), { index: 0, before: "turky sandwich", after: "turkey sandwich" });
  assert.equal(singleLineEdit("a\nb", "a\nb\nc"), null);
  assert.equal(singleLineEdit("apple\nbanana", "apple\n"), null);
  assert.equal(singleLineEdit("one\ntwo", "uno\ndos"), null);
});

test("entries are only orphaned when their line is gone", () => {
  const entries = [entry("a", "coffee", "2026-09-17T08:00:00Z"), entry("b", "coffee", "2026-09-17T09:00:00Z"), entry("c", "toast", "2026-09-17T09:30:00Z")];
  assert.deepEqual(
    entriesWithoutLines("coffee\ntoast", entries).map((item) => item.id),
    ["b"]
  );
  assert.deepEqual(entriesWithoutLines("coffee\ncoffee\ntoast", entries), []);
});

test("inline calories need an explicit unit", () => {
  assert.deepEqual(parseInlineCalories("protein shake 160 cal"), { title: "protein shake", calories: 160 });
  assert.deepEqual(parseInlineCalories("Latte - 190kcal"), { title: "Latte", calories: 190 });
  assert.equal(parseInlineCalories("coke 330"), null);
  assert.equal(parseInlineCalories("2 eggs"), null);
});

test("prefill text from deep links can never complete a line", () => {
  assert.equal(sanitizePrefill("pizza\nburger\r\n"), "pizza burger");
  assert.equal(sanitizePrefill(undefined), "");
});
