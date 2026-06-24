import { FoodEntry, FoodPortion, GoalProfile, MacroTotals } from "./types";

export function emptyMacros(): MacroTotals {
  return { calories: 0, carbs: 0, protein: 0, fat: 0 };
}

export function addMacros(a: MacroTotals, b: MacroTotals): MacroTotals {
  return {
    calories: a.calories + b.calories,
    carbs: Math.round((a.carbs + b.carbs) * 10) / 10,
    protein: Math.round((a.protein + b.protein) * 10) / 10,
    fat: Math.round((a.fat + b.fat) * 10) / 10
  };
}

export function scaleMacros(macros: MacroTotals, factor: number): MacroTotals {
  const safeFactor = Number.isFinite(factor) ? Math.max(0, factor) : 0;
  return {
    calories: Math.max(0, Math.round(macros.calories * safeFactor)),
    carbs: Math.max(0, Math.round(macros.carbs * safeFactor * 10) / 10),
    protein: Math.max(0, Math.round(macros.protein * safeFactor * 10) / 10),
    fat: Math.max(0, Math.round(macros.fat * safeFactor * 10) / 10)
  };
}

export function portionGrams(portion: FoodPortion): number | undefined {
  if (portion.unit === "g") return portion.amount;
  if (!portion.servingGrams) return undefined;
  return portion.amount * portion.servingGrams;
}

export function portionFactor(portion: FoodPortion): number {
  const amount = Number.isFinite(portion.amount) ? Math.max(0, portion.amount) : 0;
  const baseAmount = Number.isFinite(portion.baseAmount) && portion.baseAmount > 0 ? portion.baseAmount : 1;

  if (portion.unit === portion.baseUnit) return amount / baseAmount;

  if (portion.unit === "g" && portion.baseUnit === "serving" && portion.servingGrams) {
    return amount / portion.servingGrams / baseAmount;
  }

  if (portion.unit === "serving" && portion.baseUnit === "g" && portion.servingGrams) {
    return (amount * portion.servingGrams) / baseAmount;
  }

  return amount / baseAmount;
}

export function macrosForPortion(portion: FoodPortion): MacroTotals {
  return scaleMacros(portion.baseMacros, portionFactor(portion));
}

function formatAmount(value: number, maxDecimals = 2): string {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(maxDecimals)).toString();
}

export function formatPortionLabel(portion: FoodPortion): string {
  if (portion.unit === "g") return `${formatAmount(portion.amount, 1)} g`;

  const servingWord = portion.amount === 1 ? "serving" : "servings";
  const grams = portionGrams(portion);
  if (grams !== undefined) return `${formatAmount(portion.amount)} ${servingWord} (${formatAmount(grams, 1)} g)`;
  return `${formatAmount(portion.amount)} ${servingWord}`;
}

export function totalsForDay(entries: FoodEntry[], day: string): MacroTotals {
  return entries.filter((entry) => entry.day === day).reduce((total, entry) => addMacros(total, entry.macros), emptyMacros());
}

export function remainingCalories(goal: GoalProfile, totals: MacroTotals): number {
  return Math.max(0, goal.dailyCalories - totals.calories);
}

export function macroProgress(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(1, value / target));
}

export function targetsFromCalories(calories: number): Pick<GoalProfile, "proteinTarget" | "carbsTarget" | "fatTarget"> {
  return {
    proteinTarget: Math.round((calories * 0.19) / 4),
    carbsTarget: Math.round((calories * 0.5) / 4),
    fatTarget: Math.round((calories * 0.31) / 9)
  };
}
