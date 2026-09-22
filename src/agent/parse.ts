import { CalorieBias, FoodItem, FoodPortion, FoodSource, MacroTotals } from "../domain/types";
import { AgentItem, AgentLine, AgentPayload } from "./schema";

export type ParsedLine = {
  line: number;
  items: FoodItem[];
  itemServings: number[];
  assumptions: string;
  sourceLabel: string;
};

export type DraftParts = {
  title: string;
  servingLabel: string;
  macros: MacroTotals;
  confidence: number;
  sourceLabel: string;
  assumptions?: string;
  portion?: FoodPortion;
  items?: FoodItem[];
};

const MAX_ITEM_CALORIES = 6000;
const MAX_ITEM_GRAMS = 5000;

const biasFactor: Record<CalorieBias, number> = {
  under_more: 0.85,
  under: 0.93,
  balanced: 1,
  over: 1.07,
  over_more: 1.15
};

export function biasMultiplier(bias: string | undefined) {
  return biasFactor[(bias ?? "balanced") as CalorieBias] ?? 1;
}

function toNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function sumMacros(list: MacroTotals[]): MacroTotals {
  return list.reduce(
    (sum, macros) => ({
      calories: sum.calories + macros.calories,
      carbs: round1(sum.carbs + macros.carbs),
      protein: round1(sum.protein + macros.protein),
      fat: round1(sum.fat + macros.fat)
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 }
  );
}

export function scaleMacroTotals(macros: MacroTotals, factor: number): MacroTotals {
  return {
    calories: Math.max(0, Math.round(macros.calories * factor)),
    carbs: Math.max(0, round1(macros.carbs * factor)),
    protein: Math.max(0, round1(macros.protein * factor)),
    fat: Math.max(0, round1(macros.fat * factor))
  };
}

export function parseModelJson(content: string): AgentPayload {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed) as AgentPayload;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("The AI model replied with text instead of nutrition data.");
    return JSON.parse(trimmed.slice(start, end + 1)) as AgentPayload;
  }
}

const alcoholPattern = /\b(beer|wine|vodka|whisk|rum|gin|tequila|cocktail|margarita|sake|cider|lager|ale|ipa|champagne|prosecco|liquor|spirit|shot|mojito|martini|seltzer)\b/i;

/**
 * Validates one model item. Calories that are impossible for the stated macros are corrected
 * upward (undercounting is the failure users notice last), and unexplained gaps lower confidence.
 */
export function normalizeItem(raw: AgentItem): { item: FoodItem; servings: number } | null {
  const calories = toNumber(raw.calories);
  const carbs = toNumber(raw.carbs);
  const protein = toNumber(raw.protein);
  const fat = toNumber(raw.fat);
  if (calories === undefined || carbs === undefined || protein === undefined || fat === undefined) return null;

  const title = text(raw.title ?? raw.name, "Food");
  const macros: MacroTotals = {
    calories: clamp(Math.round(calories), 0, MAX_ITEM_CALORIES),
    carbs: clamp(round1(carbs), 0, 1500),
    protein: clamp(round1(protein), 0, 1500),
    fat: clamp(round1(fat), 0, 700)
  };
  let confidence = clamp(toNumber(raw.confidence) ?? 0.65, 0, 1);

  const fromMacros = macros.carbs * 4 + macros.protein * 4 + macros.fat * 9;
  if (fromMacros > 40 || macros.calories > 40) {
    if (macros.calories < fromMacros * 0.8) {
      macros.calories = clamp(Math.round(fromMacros), 0, MAX_ITEM_CALORIES);
      confidence = Math.min(confidence, 0.6);
    } else if (macros.calories > fromMacros * 1.3 + 20 && !alcoholPattern.test(title)) {
      confidence = Math.min(confidence, 0.5);
    }
  }

  const gramsValue = toNumber(raw.grams);
  const grams = gramsValue !== undefined && gramsValue > 0 ? clamp(round1(gramsValue), 0, MAX_ITEM_GRAMS) : undefined;
  const servingsValue = toNumber(raw.servings);
  const servings = servingsValue !== undefined && servingsValue > 0 && servingsValue <= 50 ? servingsValue : 1;

  return {
    item: { title, servingLabel: text(raw.servingLabel, "1 serving"), grams, macros, confidence },
    servings
  };
}

function cleanSourceLabel(value: unknown, source: FoodSource) {
  if (source === "label_ocr") return "Label estimate";
  const candidate = text(value, "Amy estimate");
  return /restaurant/i.test(candidate) ? "Restaurant estimate" : "Amy estimate";
}

function parseLine(raw: AgentLine, fallbackLine: number, source: FoodSource): ParsedLine {
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const normalized = rawItems
    .map((item) => (typeof item === "object" && item ? normalizeItem(item as AgentItem) : null))
    .filter((value): value is { item: FoodItem; servings: number } => Boolean(value));
  const lineNumber = toNumber(raw.line);
  return {
    line: lineNumber !== undefined && lineNumber >= 1 ? Math.round(lineNumber) : fallbackLine,
    items: normalized.map((value) => value.item),
    itemServings: normalized.map((value) => value.servings),
    assumptions: text(raw.assumptions, "").slice(0, 200),
    sourceLabel: cleanSourceLabel(raw.sourceLabel, source)
  };
}

export function parseAgentPayload(payload: AgentPayload, source: FoodSource): ParsedLine[] {
  if (Array.isArray(payload.lines)) {
    return payload.lines
      .filter((line): line is AgentLine => typeof line === "object" && line !== null)
      .map((line, index) => parseLine(line, index + 1, source));
  }
  if (Array.isArray(payload.items)) return [parseLine(payload as AgentLine, 1, source)];
  return [];
}

/** Turns one parsed line into entry fields. Single items become scalable portions. */
export function draftPartsFromLine(parsed: ParsedLine, rawLine: string, options: { bias?: string; source: FoodSource }): DraftParts | null {
  if (!parsed.items.length) return null;
  // Labels are transcribed, not estimated, so the user's bias preference does not apply to them.
  const factor = options.source === "label_ocr" ? 1 : biasMultiplier(options.bias);
  const items = parsed.items.map((item) => (factor === 1 ? item : { ...item, macros: scaleMacroTotals(item.macros, factor) }));

  if (items.length === 1) {
    const item = items[0]!;
    const servings = parsed.itemServings[0] ?? 1;
    const portion: FoodPortion = {
      amount: servings,
      unit: "serving",
      servingLabel: item.servingLabel,
      servingGrams: item.grams ? round1(item.grams / servings) : undefined,
      baseAmount: servings,
      baseUnit: "serving",
      baseMacros: item.macros
    };
    return {
      title: item.title,
      servingLabel: item.servingLabel,
      macros: item.macros,
      confidence: item.confidence,
      sourceLabel: parsed.sourceLabel,
      assumptions: parsed.assumptions || undefined,
      portion
    };
  }

  const totalCalories = items.reduce((sum, item) => sum + item.macros.calories, 0);
  const confidence =
    totalCalories > 0
      ? items.reduce((sum, item) => sum + item.confidence * item.macros.calories, 0) / totalCalories
      : items.reduce((sum, item) => sum + item.confidence, 0) / items.length;
  return {
    title: rawLine.trim() || items.map((item) => item.title).join(", "),
    servingLabel: `${items.length} items`,
    macros: sumMacros(items.map((item) => item.macros)),
    confidence,
    sourceLabel: parsed.sourceLabel,
    assumptions: parsed.assumptions || undefined,
    items
  };
}
