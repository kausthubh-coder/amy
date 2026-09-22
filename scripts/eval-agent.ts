/**
 * Accuracy check for Amy's text agent. Runs the real prompt/parse pipeline against a small golden
 * set and reports error per line, so prompt and model changes can be compared with numbers.
 *
 *   OPENROUTER_API_KEY=sk-or-... npm run eval:agent
 *   OPENROUTER_API_KEY=... AMY_MODEL=anthropic/claude-haiku-4.5 npm run eval:agent
 *
 * Reference calories are approximate (USDA FoodData Central typical values and published chain
 * nutrition, US region). They are a yardstick for regressions, not ground truth to the calorie.
 */
import { estimateTextLines, LineEstimate } from "../src/agent/estimate";

type Case = { line: string; kcal: number; note?: string };

const cases: Case[] = [
  { line: "2 large eggs scrambled in butter", kcal: 215 },
  { line: "1 medium banana", kcal: 105 },
  { line: "1 cup cooked white rice", kcal: 205 },
  { line: "6 oz grilled chicken breast", kcal: 280 },
  { line: "1 tbsp olive oil", kcal: 119 },
  { line: "2 slices whole wheat toast with 1 tbsp peanut butter", kcal: 255 },
  { line: "1 cup whole milk", kcal: 149 },
  { line: "oatmeal with banana", kcal: 260, note: "1 cup cooked oats + medium banana" },
  { line: "turkey sandwich", kcal: 360, note: "2 slices bread, deli turkey, mayo" },
  { line: "caesar salad with chicken", kcal: 470, note: "restaurant entree portion" },
  { line: "1 medium avocado", kcal: 240 },
  { line: "1 oz almonds", kcal: 164 },
  { line: "greek yogurt plain nonfat 170g", kcal: 100 },
  { line: "12 oz can of coke", kcal: 140 },
  { line: "pint of IPA", kcal: 260 },
  { line: "5 oz glass of red wine", kcal: 125 },
  { line: "grande latte with whole milk from Starbucks", kcal: 220 },
  { line: "big mac", kcal: 590 },
  { line: "big mac meal with medium fries and medium coke", kcal: 1120 },
  { line: "chipotle chicken burrito with rice, black beans, salsa, cheese, sour cream", kcal: 1060 },
  { line: "2 slices pepperoni pizza", kcal: 600, note: "large 14 inch chain pizza" },
  { line: "chick-fil-a chicken sandwich", kcal: 420 },
  { line: "1 cup cooked spaghetti with marinara", kcal: 300 },
  { line: "protein shake with 1 scoop whey and water", kcal: 120 },
  { line: "apple", kcal: 95 },
  { line: "handful of potato chips", kcal: 150, note: "about 1 oz" },
  { line: "3 chocolate chip cookies", kcal: 230, note: "regular packaged size" },
  { line: "bowl of cheerios with 2% milk", kcal: 210 },
  { line: "salmon fillet 6 oz baked", kcal: 350 },
  { line: "pad thai with chicken", kcal: 900, note: "restaurant portion" }
];

const notFood = ["felt tired after lunch", "call mom"];

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  if (!apiKey) {
    console.error("Set OPENROUTER_API_KEY to run the agent eval.");
    process.exit(1);
  }
  const model = process.env.AMY_MODEL;
  const context = { now: new Date(2026, 0, 15, 12, 30), locale: "en-US", countryCode: "US" };
  const lines = [...cases.map((item) => item.line), ...notFood];
  const started = Date.now();
  const results: LineEstimate[] = [];
  for (let start = 0; start < lines.length; start += 8) {
    results.push(...(await estimateTextLines(lines.slice(start, start + 8), { apiKey, model }, context)));
  }
  const seconds = (Date.now() - started) / 1000;

  let absPct = 0;
  let signedPct = 0;
  let scored = 0;
  let within20 = 0;
  console.log("\nline".padEnd(74), "ref".padStart(6), "got".padStart(6), "err%".padStart(7), "conf".padStart(6));
  cases.forEach((item, index) => {
    const result = results[index];
    if (!result || result.status !== "ok") {
      console.log(item.line.slice(0, 72).padEnd(73), String(item.kcal).padStart(6), (result?.status ?? "missing").padStart(6));
      return;
    }
    const got = result.draft.macros.calories;
    const pct = ((got - item.kcal) / item.kcal) * 100;
    absPct += Math.abs(pct);
    signedPct += pct;
    scored += 1;
    if (Math.abs(pct) <= 20) within20 += 1;
    console.log(item.line.slice(0, 72).padEnd(73), String(item.kcal).padStart(6), String(got).padStart(6), pct.toFixed(0).padStart(7), result.draft.confidence.toFixed(2).padStart(6));
  });

  const rejected = notFood.filter((_, index) => results[cases.length + index]?.status === "not-food").length;
  console.log(`\nmodel: ${model ?? "(app default)"}   time: ${seconds.toFixed(1)}s for ${lines.length} lines`);
  console.log(`scored ${scored}/${cases.length}   mean abs error ${(absPct / Math.max(1, scored)).toFixed(1)}%   bias ${(signedPct / Math.max(1, scored)).toFixed(1)}%   within 20%: ${within20}/${scored}`);
  console.log(`non-food lines rejected: ${rejected}/${notFood.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
