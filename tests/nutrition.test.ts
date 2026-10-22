import assert from "node:assert/strict";
import { test } from "node:test";

import { formatPortionLabel, macrosForPortion, portionFactor, portionGrams, remainingCalories, scaleMacros, targetsFromCalories, totalsForDay } from "../src/domain/nutrition";
import { FoodEntry, FoodPortion, MacroTotals } from "../src/domain/types";

const twoEggsMacros: MacroTotals = { calories: 144, carbs: 0.8, protein: 12.6, fat: 9.6 };
// What the agent produces for "2 eggs": a 2-serving portion of 50 g eggs.
const twoEggs: FoodPortion = { amount: 2, unit: "serving", servingLabel: "2 large eggs", servingGrams: 50, baseAmount: 2, baseUnit: "serving", baseMacros: twoEggsMacros };

function entry(day: string, macros: MacroTotals): FoodEntry {
  return { id: `${day}-${macros.calories}`, day, title: "Food", servingLabel: "1 serving", macros, source: "manual", confidence: 1, createdAt: `${day}T12:00:00Z`, updatedAt: `${day}T12:00:00Z` };
}

test("changing the servings scales calories and macros from the base portion", () => {
  assert.deepEqual(macrosForPortion({ ...twoEggs, amount: 3 }), { calories: 216, carbs: 1.2, protein: 18.9, fat: 14.4 });
  assert.deepEqual(macrosForPortion({ ...twoEggs, amount: 1 }), { calories: 72, carbs: 0.4, protein: 6.3, fat: 4.8 });
});

test("grams convert through the serving weight", () => {
  // 2 servings x 50 g = 100 g base, so 150 g is one and a half times the base.
  assert.equal(portionFactor({ ...twoEggs, amount: 150, unit: "g" }), 1.5);
  assert.equal(macrosForPortion({ ...twoEggs, amount: 150, unit: "g" }).calories, 216);
  assert.equal(portionGrams(twoEggs), 100);
  assert.equal(portionGrams({ ...twoEggs, servingGrams: undefined }), undefined);
});

test("a per-100 g product (Open Food Facts) scales by weight", () => {
  const per100: FoodPortion = { amount: 100, unit: "g", servingLabel: "100 g", baseAmount: 100, baseUnit: "g", baseMacros: { calories: 500, carbs: 60, protein: 7, fat: 25 } };
  assert.deepEqual(macrosForPortion({ ...per100, amount: 30 }), { calories: 150, carbs: 18, protein: 2.1, fat: 7.5 });
  assert.equal(formatPortionLabel({ ...per100, amount: 30 }), "30 g");
});

test("portion labels read naturally", () => {
  assert.equal(formatPortionLabel(twoEggs), "2 servings (100 g)");
  assert.equal(formatPortionLabel({ ...twoEggs, amount: 1 }), "1 serving (50 g)");
  assert.equal(formatPortionLabel({ ...twoEggs, amount: 1.5, servingGrams: undefined }), "1.5 servings");
});

test("impossible amounts never produce negative or NaN nutrition", () => {
  assert.deepEqual(macrosForPortion({ ...twoEggs, amount: Number.NaN }), { calories: 0, carbs: 0, protein: 0, fat: 0 });
  assert.deepEqual(scaleMacros(twoEggsMacros, -1), { calories: 0, carbs: 0, protein: 0, fat: 0 });
  assert.equal(portionFactor({ ...twoEggs, baseAmount: 0, amount: 2 }), 2);
});

test("day totals only count that day and keep one decimal", () => {
  const entries = [
    entry("2026-10-22", { calories: 100, carbs: 10.2, protein: 5.5, fat: 2.2 }),
    entry("2026-10-22", { calories: 50, carbs: 0.1, protein: 0.3, fat: 0.1 }),
    entry("2026-10-21", { calories: 999, carbs: 99, protein: 99, fat: 99 })
  ];
  assert.deepEqual(totalsForDay(entries, "2026-10-22"), { calories: 150, carbs: 10.3, protein: 5.8, fat: 2.3 });
  assert.deepEqual(totalsForDay(entries, "2026-10-23"), { calories: 0, carbs: 0, protein: 0, fat: 0 });
});

test("remaining calories stop at zero and default macro targets follow the 19/50/31 split", () => {
  const goal = { dailyCalories: 2000, weightGoalLbs: 0, currentWeightLbs: 0, proteinTarget: 0, carbsTarget: 0, fatTarget: 0 };
  assert.equal(remainingCalories(goal, { calories: 2300, carbs: 0, protein: 0, fat: 0 }), 0);
  assert.equal(remainingCalories(goal, { calories: 1500, carbs: 0, protein: 0, fat: 0 }), 500);
  assert.deepEqual(targetsFromCalories(2000), { proteinTarget: 95, carbsTarget: 250, fatTarget: 69 });
});
