import assert from "node:assert/strict";
import { test } from "node:test";

import { buildLineRows, entriesWithoutLines, isLoggableLine, isSmallLineEdit, parseInlineCalories, sanitizePrefill, singleLineEdit, undoRemovedLines } from "../src/domain/lines";
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

test("inline calories with a thousands separator are not read as one calorie", () => {
  assert.deepEqual(parseInlineCalories("big dinner 1,200 cal"), { title: "big dinner", calories: 1200 });
  assert.deepEqual(parseInlineCalories("pie 1,234.5 cal"), { title: "pie", calories: 1235 });
  assert.deepEqual(parseInlineCalories("pizza 1.200 kcal"), { title: "pizza", calories: 1200 });
  assert.deepEqual(parseInlineCalories("yogurt 90,5 cal"), { title: "yogurt", calories: 91 });
});

test("rewriting a line into a different food is a new line, not an edit of the old entry", () => {
  assert.equal(singleLineEdit("coffee\ntoast", "pizza\ntoast"), null);
  assert.equal(singleLineEdit("coffee\ntoast", "coffee with milk\ntoast"), null);
  assert.deepEqual(singleLineEdit("2 eggs\ntoast", "3 eggs\ntoast"), { index: 0, before: "2 eggs", after: "3 eggs" });
  assert.deepEqual(singleLineEdit("latte 190 cal", "latte 200 cal"), { index: 0, before: "latte 190 cal", after: "latte 200 cal" });
  assert.equal(isSmallLineEdit("chiken salad", "chicken salad"), true);
  assert.equal(isSmallLineEdit("coffee", "pizza"), false);
});

test("an entry with an empty raw line pairs by its title instead of hiding", () => {
  const ghost = { ...entry("g", "", "2026-09-17T08:00:00Z"), title: "Ghost food" };
  assert.equal(buildLineRows("ghost food", [ghost], {})[0]?.entry?.id, "g");
  assert.deepEqual(
    entriesWithoutLines("", [ghost]).map((item) => item.id),
    ["g"]
  );
});

test("undo after a removal puts the lines back where the person expects", () => {
  const removed = [entry("a", "protein shake", "2026-09-17T09:00:00Z")];
  // Nothing typed since the removal: the note is exactly what it was.
  assert.equal(undoRemovedLines("2026-09-17", "coffee\n", "coffee\nprotein shake\n", "coffee\n", removed).next, "coffee\nprotein shake\n");
  // Typed since: the removed line is appended and the new typing stays.
  assert.equal(undoRemovedLines("2026-09-17", "coffee\ntoast", "coffee\nprotein shake\n", "coffee\n", removed).next, "coffee\ntoast\nprotein shake");
  // Removed while viewing another day: the entry goes back to its own day, not into this note.
  const other = undoRemovedLines("2026-09-18", "salad", "coffee\nprotein shake\n", "coffee\n", removed);
  assert.equal(other.next, null);
  assert.deepEqual(other.here, []);
  assert.deepEqual(other.elsewhere.map((item) => item.id), ["a"]);
});
