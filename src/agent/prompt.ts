import { MacroTotals } from "../domain/types";

export type AgentMode = "text" | "photo" | "label";

export type KnownFood = {
  name: string;
  servingLabel: string;
  macros: MacroTotals;
};

export type AgentContext = {
  now?: Date;
  locale?: string;
  locationLabel?: string;
  countryCode?: string;
  earlierLines?: string[];
  knownFoods?: KnownFood[];
};

const sharedRules = [
  "You are Amy, the nutrition estimator inside a calorie-tracking notes app. The user logs food in plain language and trusts your numbers, so be realistic, specific, and consistent.",
  "",
  "Output rules:",
  "- Return one result per numbered input line, using the same line number.",
  "- Split a line into separate items when it names distinct foods (sandwich, chips, and a drink are three items). Keep one item for a single dish.",
  "- Every number is the TOTAL for the amount eaten, not per serving and not per 100 g.",
  "- grams is your best estimate of the total weight eaten (ml for drinks). Use 0 only when you truly cannot guess.",
  "- calories must agree with the macros: about 4 kcal/g carbs, 4 kcal/g protein, 9 kcal/g fat, plus 7 kcal/g alcohol.",
  "- If a line is not food or drink (a mood note, a reminder), return an empty items array for it.",
  "- title is a short editable food name. Never use a file name, URI, or the word 'image'.",
  "",
  "Estimating:",
  "- Respect quantities, sizes, brands, and cooking methods the user states. When they are missing, assume one typical adult portion as actually served, not a diet portion.",
  "- Count what people forget: cooking oil and butter, dressings, sauces, cheese, sugar and milk in drinks, sides that come with a combo.",
  "- Restaurant and fast-food portions are larger than home portions. For named chains and packaged brands use the published nutrition for the user's region.",
  "- Never round down to look healthier. If torn between two portions, pick the more common one and say so in assumptions.",
  "- The user's known foods are ground truth. When a line clearly refers to one, reuse its values (scaled by any stated quantity).",
  "",
  "Confidence rubric: 0.9+ exact label or published brand item; 0.75 common food with a stated quantity; 0.6 common food, quantity guessed; 0.4 vague description ('lunch', 'a snack', 'some pasta').",
  "assumptions: one short sentence (max 140 characters) naming the portions you assumed, e.g. 'Assumed 2 slices bread, 3 oz turkey, 1 tbsp mayo.'",
  "sourceLabel: 'Restaurant estimate' for restaurant or chain items, 'Label estimate' when read from a nutrition label, otherwise 'Amy estimate'."
];

const modeRules: Record<AgentMode, string[]> = {
  text: [],
  photo: [
    "",
    "Photo mode:",
    "- All attached photos show one meal, possibly from several angles. Do not count the same food twice. Return a single line numbered 1.",
    "- Identify each visible food as its own item. Judge portion size from plates, bowls, utensils, hands, and packaging in frame.",
    "- Include likely hidden calories: oil on roasted or fried food, butter, dressing on salads, sauces.",
    "- The user's note, when present, overrides what you think you see (e.g. 'ate half', 'no dressing').",
    "- If no food is visible, return an empty items array and explain why in assumptions."
  ],
  label: [
    "",
    "Label mode:",
    "- The photos show a nutrition facts panel and/or packaging. Transcribe the label; do not estimate when the label is readable. Return a single line numbered 1 with one item.",
    "- servings is how many label servings the user ate: use their note ('whole bag', 'half', '2 bars') and the servings-per-container line; default to 1 serving.",
    "- servingLabel is the label's serving size (e.g. '1 bar (40 g)'). grams is serving grams x servings. Convert kJ to kcal (divide by 4.184).",
    "- calories/carbs/protein/fat are per-serving label values multiplied by servings.",
    "- Use the product name from the packaging as the title. Confidence 0.95 when the panel is readable.",
    "- If the panel is unreadable, return an empty items array and say what was unreadable in assumptions."
  ]
};

export function systemPrompt(mode: AgentMode) {
  return [...sharedRules, ...modeRules[mode], "", "Respond with JSON only, matching the provided schema. No markdown."].join("\n");
}

function mealPeriod(hour: number) {
  if (hour < 5) return "late night";
  if (hour < 11) return "breakfast time";
  if (hour < 15) return "lunch time";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "dinner time";
  return "late evening";
}

function regionFromLocale(locale?: string) {
  const match = locale?.match(/[-_]([A-Za-z]{2})\b/);
  return match?.[1]?.toUpperCase();
}

export function contextBlock(context: AgentContext | undefined) {
  if (!context) return "";
  const lines: string[] = [];
  const now = context.now ?? new Date();
  const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];
  lines.push(`- Local time: ${weekday} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} (${mealPeriod(now.getHours())})`);

  const region = context.countryCode?.toUpperCase() || regionFromLocale(context.locale);
  if (region) {
    const usCustomary = region === "US" || region === "LR" || region === "MM";
    lines.push(`- Region: ${region}${context.locale ? ` (${context.locale})` : ""}; units: ${usCustomary ? "US customary (cups, oz, fl oz)" : "metric"}; use this region's brand and restaurant nutrition values.`);
  }
  if (context.locationLabel) lines.push(`- Rough location: ${context.locationLabel}. Use it to resolve local restaurants, chains, and regional dishes.`);

  const earlier = (context.earlierLines ?? []).map((line) => line.trim()).filter(Boolean).slice(-12);
  if (earlier.length) lines.push(`- Already logged today (context only, do not re-estimate): ${earlier.map((line) => `"${line}"`).join(", ")}`);

  const known = (context.knownFoods ?? []).slice(0, 20);
  if (known.length) {
    lines.push("- User's known foods:");
    known.forEach((food) => {
      lines.push(
        `  - "${food.name}" = ${Math.round(food.macros.calories)} kcal, C${Math.round(food.macros.carbs)} P${Math.round(food.macros.protein)} F${Math.round(food.macros.fat)} (${food.servingLabel})`
      );
    });
  }
  return lines.length ? `Context:\n${lines.join("\n")}` : "";
}

export function textUserPrompt(lines: string[], context?: AgentContext) {
  const numbered = lines.map((line, index) => `${index + 1}. ${line.trim()}`).join("\n");
  return [`Estimate nutrition for each line:`, numbered, contextBlock(context)].filter(Boolean).join("\n\n");
}

export function imageUserPrompt(mode: "photo" | "label", note: string | undefined, imageCount: number, context?: AgentContext) {
  const task =
    mode === "label"
      ? `Read the nutrition label in the ${imageCount > 1 ? `${imageCount} attached photos` : "attached photo"} and log what the user ate.`
      : `Estimate the meal shown in the ${imageCount > 1 ? `${imageCount} attached photos` : "attached photo"}.`;
  const cleanNote = note?.trim();
  return [task, cleanNote ? `User note: ${cleanNote}` : "", contextBlock(context)].filter(Boolean).join("\n\n");
}

const chainPattern =
  /\b(mcdonald|burger king|wendy|taco bell|chipotle|chick-?fil-?a|starbucks|dunkin|subway|kfc|popeyes|domino|pizza hut|papa john|panera|five guys|in-?n-?out|shake shack|panda express|olive garden|applebee|ihop|denny|sonic|arby|jack in the box|dairy queen|tim hortons|nando|greggs|pret|costa|wagamama|jollibee|sweetgreen|cava|wingstop|raising cane|culver|whataburger|zaxby|jersey mike|jimmy john|little caesars|costco|trader joe|whole foods)/i;

/** Web search costs money and time, so only use it when the text points at a brand, chain, or venue. */
export function shouldUseWebSearch(text: string) {
  if (chainPattern.test(text)) return true;
  if (/\b(from|at)\s+(the\s+)?[A-Z][\w'&-]+/.test(text)) return true;
  if (/[A-Za-z]'s\b/.test(text) && /\b(from|at|meal|combo|menu)\b/i.test(text)) return true;
  return /\b(restaurant|takeout|take-out|takeaway|drive[- ]?thru|menu|brand)\b/i.test(text);
}
