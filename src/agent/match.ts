import { normalizeMealLine, parseInlineCalories } from "../domain/lines";
import { FoodCorrection, FoodItem, FoodPortion, FoodSource, MacroTotals, SavedMeal } from "../domain/types";
import { KnownFood } from "./prompt";
import { scaleMacroTotals } from "./parse";

export type LocalMatch = {
  kind: "correction" | "saved_meal" | "inline";
  title: string;
  servingLabel: string;
  macros: MacroTotals;
  source: FoodSource;
  sourceLabel: string;
  confidence: number;
  portion?: FoodPortion;
  items?: FoodItem[];
};

function quantityPrefix(norm: string): { quantity: number; rest: string } | null {
  const match = norm.match(/^(\d+(?:\.\d+)?|half|a|an|one|two|three|four)\s*x?\s+(.+)$/);
  if (!match) return null;
  const words: Record<string, number> = { half: 0.5, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };
  const token = match[1] ?? "";
  const quantity = words[token] ?? Number(token);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 20) return null;
  return { quantity, rest: match[2] ?? "" };
}

function singular(value: string) {
  return value
    .split(" ")
    .map((word) => {
      if (word.length <= 3 || !word.endsWith("s") || word.endsWith("ss")) return word;
      if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
      if (/(ch|sh|x|ss|z)es$/.test(word)) return word.slice(0, -2);
      return word.slice(0, -1);
    })
    .join(" ");
}

function scalePortion(portion: FoodPortion | undefined, factor: number): FoodPortion | undefined {
  return portion ? { ...portion, amount: portion.amount * factor } : undefined;
}

/**
 * Resolves a log line without the network: what the user confirmed before, a saved meal by name
 * (optionally with a leading quantity), or calories typed inline ("latte 190 cal").
 */
export function findLocalMatch(line: string, corrections: FoodCorrection[], savedMeals: SavedMeal[]): LocalMatch | null {
  const norm = normalizeMealLine(line);
  if (!norm) return null;

  const fromCorrection = (correction: FoodCorrection, factor: number): LocalMatch => ({
    kind: "correction",
    title: correction.title,
    servingLabel: factor === 1 ? correction.servingLabel : `${factor} x ${correction.servingLabel}`,
    macros: scaleMacroTotals(correction.macros, factor),
    source: "manual",
    sourceLabel: "Your numbers",
    confidence: 1,
    portion: scalePortion(correction.portion, factor),
    items: factor === 1 ? correction.items : correction.items?.map((item) => ({ ...item, macros: scaleMacroTotals(item.macros, factor) }))
  });
  const fromSaved = (meal: SavedMeal, factor: number): LocalMatch => ({
    kind: "saved_meal",
    title: meal.title,
    servingLabel: factor === 1 ? meal.servingLabel : `${factor} x ${meal.servingLabel}`,
    macros: scaleMacroTotals(meal.macros, factor),
    source: "saved_meal",
    sourceLabel: "Saved meal",
    confidence: 1,
    portion: scalePortion(meal.portion, factor)
  });

  const exact = corrections.find((correction) => correction.key === norm);
  if (exact) return fromCorrection(exact, 1);
  const savedExact = savedMeals.find((meal) => normalizeMealLine(meal.title) === norm);
  if (savedExact) return fromSaved(savedExact, 1);

  const quantified = quantityPrefix(norm);
  if (quantified) {
    const rest = singular(quantified.rest);
    const correction = corrections.find((item) => singular(item.key) === rest);
    if (correction) return fromCorrection(correction, quantified.quantity);
    const meal = savedMeals.find((item) => singular(normalizeMealLine(item.title)) === rest);
    if (meal) return fromSaved(meal, quantified.quantity);
  }

  const inline = parseInlineCalories(line);
  if (inline) {
    return {
      kind: "inline",
      title: inline.title,
      servingLabel: "1 serving",
      macros: { calories: inline.calories, carbs: 0, protein: 0, fat: 0 },
      source: "manual",
      sourceLabel: "Typed calories",
      confidence: 1
    };
  }
  return null;
}

/** Known foods most relevant to the lines being estimated, for the model's context block. */
export function relevantKnownFoods(lines: string[], corrections: FoodCorrection[], savedMeals: SavedMeal[], limit = 16): KnownFood[] {
  const words = new Set(
    lines
      .flatMap((line) => normalizeMealLine(line).split(/[^a-z0-9À-￿]+/))
      .map(singular)
      .filter((word) => word.length > 2)
  );
  const score = (name: string) =>
    normalizeMealLine(name)
      .split(/[^a-z0-9À-￿]+/)
      .map(singular)
      .filter((word) => words.has(word)).length;

  const candidates: Array<KnownFood & { score: number; weight: number }> = [
    ...corrections.map((item) => ({ name: item.key, servingLabel: item.servingLabel, macros: item.macros, score: score(item.key), weight: item.uses })),
    ...savedMeals.map((meal) => ({ name: meal.title, servingLabel: meal.servingLabel, macros: meal.macros, score: score(meal.title), weight: 1 }))
  ];
  return candidates
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.weight - a.weight)
    .slice(0, limit)
    .map(({ name, servingLabel, macros }) => ({ name, servingLabel, macros }));
}
