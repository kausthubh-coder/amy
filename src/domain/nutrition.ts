import { FoodEntry, GoalProfile, MacroTotals } from "./types";

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
