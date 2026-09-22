import assert from "node:assert/strict";
import { test } from "node:test";

import { findLocalMatch, relevantKnownFoods } from "../src/agent/match";
import { biasMultiplier, draftPartsFromLine, normalizeItem, parseAgentPayload, parseModelJson } from "../src/agent/parse";
import { contextBlock, shouldUseWebSearch, textUserPrompt } from "../src/agent/prompt";
import { FoodCorrection, SavedMeal } from "../src/domain/types";

test("undercounted calories are lifted to match macros", () => {
  const result = normalizeItem({ title: "Chicken", servingLabel: "1", calories: 50, carbs: 0, protein: 80, fat: 10 });
  assert.equal(result?.item.macros.calories, 410);
  assert.ok((result?.item.confidence ?? 1) <= 0.6);
});

test("alcohol may exceed its macro calories without a penalty", () => {
  const beer = normalizeItem({ title: "IPA beer", servingLabel: "1 pint", calories: 250, carbs: 20, protein: 2, fat: 0, confidence: 0.8 });
  assert.equal(beer?.item.macros.calories, 250);
  assert.equal(beer?.item.confidence, 0.8);
  const mystery = normalizeItem({ title: "Rice", servingLabel: "1 cup", calories: 600, carbs: 45, protein: 4, fat: 0, confidence: 0.8 });
  assert.equal(mystery?.item.confidence, 0.5);
});

test("items missing numbers are rejected", () => {
  assert.equal(normalizeItem({ title: "x", calories: "abc", carbs: 1, protein: 1, fat: 1 }), null);
});

test("fenced and chatty model replies still parse", () => {
  const payload = parseModelJson('Sure!\n```json\n{"lines":[{"line":1,"items":[],"assumptions":"","sourceLabel":"Amy estimate"}]}\n```');
  assert.equal(parseAgentPayload(payload, "ai_text").length, 1);
  assert.throws(() => parseModelJson("I cannot help with that"));
});

test("a single item becomes a scalable portion", () => {
  const [line] = parseAgentPayload(
    {
      lines: [
        {
          line: 1,
          items: [{ title: "Eggs", servingLabel: "2 large eggs", servings: 2, grams: 100, calories: 144, carbs: 0.8, protein: 12.6, fat: 9.6, confidence: 0.8 }],
          assumptions: "Assumed large eggs.",
          sourceLabel: "Amy estimate"
        }
      ]
    },
    "ai_text"
  );
  const draft = draftPartsFromLine(line!, "2 eggs", { source: "ai_text" });
  assert.equal(draft?.portion?.amount, 2);
  assert.equal(draft?.portion?.servingGrams, 50);
  assert.equal(draft?.assumptions, "Assumed large eggs.");
  assert.equal(draft?.items, undefined);
});

test("multi-item lines keep their breakdown and sum correctly", () => {
  const item = (title: string, calories: number) => ({
    title,
    servingLabel: "1",
    servings: 1,
    grams: 0,
    calories,
    carbs: calories / 8,
    protein: calories / 16,
    fat: calories / 36,
    confidence: 0.7
  });
  const [line] = parseAgentPayload(
    { lines: [{ line: 1, items: [item("Sandwich", 400), item("Chips", 160), item("Coke", 140)], assumptions: "", sourceLabel: "Restaurant estimate" }] },
    "ai_text"
  );
  const draft = draftPartsFromLine(line!, "sandwich chips coke", { source: "ai_text" });
  assert.equal(draft?.items?.length, 3);
  assert.equal(draft?.macros.calories, 700);
  assert.equal(draft?.title, "sandwich chips coke");
  assert.equal(draft?.sourceLabel, "Restaurant estimate");
});

test("bias is a deterministic multiplier and never touches labels", () => {
  assert.equal(biasMultiplier("over"), 1.07);
  assert.equal(biasMultiplier("nonsense"), 1);
  const payload = {
    lines: [
      {
        line: 1,
        items: [{ title: "Bar", servingLabel: "1 bar", servings: 1, grams: 40, calories: 200, carbs: 20, protein: 10, fat: 9, confidence: 0.95 }],
        assumptions: "",
        sourceLabel: "x"
      }
    ]
  };
  const text = draftPartsFromLine(parseAgentPayload(payload, "ai_text")[0]!, "bar", { source: "ai_text", bias: "over_more" });
  const label = draftPartsFromLine(parseAgentPayload(payload, "label_ocr")[0]!, "bar", { source: "label_ocr", bias: "over_more" });
  assert.equal(text?.macros.calories, 230);
  assert.equal(label?.macros.calories, 200);
  assert.equal(label?.sourceLabel, "Label estimate");
});

test("non-food lines produce no draft", () => {
  const [line] = parseAgentPayload({ lines: [{ line: 1, items: [], assumptions: "Not food.", sourceLabel: "Amy estimate" }] }, "ai_text");
  assert.equal(draftPartsFromLine(line!, "felt tired", { source: "ai_text" }), null);
});

const corrections: FoodCorrection[] = [
  { key: "protein shake", title: "Protein shake", servingLabel: "1 shake", macros: { calories: 160, carbs: 8, protein: 30, fat: 2 }, uses: 3, updatedAt: "2026-09-01T00:00:00Z" }
];
const savedMeals: SavedMeal[] = [
  { id: "s1", title: "Two eggs and toast", servingLabel: "1 plate", macros: { calories: 390, carbs: 34, protein: 22, fat: 18 }, createdAt: "2026-09-01T00:00:00Z" }
];

test("repeat foods resolve locally, with quantities", () => {
  assert.equal(findLocalMatch("Protein  Shake", corrections, savedMeals)?.macros.calories, 160);
  assert.equal(findLocalMatch("2 protein shakes", corrections, savedMeals)?.macros.calories, 320);
  assert.equal(findLocalMatch("two eggs and toast", corrections, savedMeals)?.kind, "saved_meal");
  const sandwich: FoodCorrection = { ...corrections[0]!, key: "turkey sandwich", macros: { calories: 360, carbs: 30, protein: 20, fat: 15 } };
  assert.equal(findLocalMatch("2 turkey sandwiches", [sandwich], [])?.macros.calories, 720);
  assert.equal(findLocalMatch("3 blueberries", [{ ...sandwich, key: "blueberry" }], [])?.macros.calories, 1080);
  assert.equal(findLocalMatch("latte 190 cal", corrections, savedMeals)?.kind, "inline");
  assert.equal(findLocalMatch("turkey sandwich", corrections, savedMeals), null);
});

test("known foods are filtered to the lines being estimated", () => {
  assert.equal(relevantKnownFoods(["vanilla protein shake with banana"], corrections, savedMeals).length, 1);
  assert.equal(relevantKnownFoods(["pad thai"], corrections, savedMeals).length, 0);
});

test("web search is reserved for brands and venues", () => {
  assert.equal(shouldUseWebSearch("2 eggs and toast"), false);
  assert.equal(shouldUseWebSearch("big mac meal from McDonalds"), true);
  assert.equal(shouldUseWebSearch("burrito bowl at Chipotle"), true);
});

test("the prompt numbers lines and carries context", () => {
  const prompt = textUserPrompt(["oatmeal", "coffee"], {
    now: new Date(2026, 8, 17, 8, 5),
    locale: "en-GB",
    locationLabel: "Camden, London",
    earlierLines: ["toast"]
  });
  assert.match(prompt, /1\. oatmeal\n2\. coffee/);
  assert.match(prompt, /breakfast time/);
  assert.match(prompt, /Region: GB.*metric/);
  assert.match(prompt, /Camden, London/);
  assert.match(prompt, /"toast"/);
  assert.equal(contextBlock(undefined), "");
});
