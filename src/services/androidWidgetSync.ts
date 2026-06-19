import { NativeModules, Platform } from "react-native";

import { remainingCalories, totalsForDay } from "../domain/nutrition";
import { AmyLocalData } from "../domain/types";
import { toDateKey } from "../utils/date";

type AmyWidgetModule = {
  updateWidgetState?: (payload: string) => Promise<boolean>;
};

function todayLabel() {
  return new Date().toLocaleDateString(undefined, { weekday: "short" });
}

export async function syncAndroidWidgets(data: AmyLocalData): Promise<void> {
  if (Platform.OS !== "android") return;

  const module = NativeModules.AmyWidgetModule as AmyWidgetModule | undefined;
  if (!module?.updateWidgetState) return;

  const today = toDateKey(new Date());
  const totals = totalsForDay(data.entries, today);
  const note = data.dayNotes.find((item) => item.day === today)?.text ?? "";
  const payload = {
    day: today,
    dayLabel: todayLabel(),
    note,
    caloriesConsumed: Math.round(totals.calories),
    caloriesGoal: data.goal.dailyCalories,
    caloriesRemaining: remainingCalories(data.goal, totals),
    carbs: Math.round(totals.carbs),
    protein: Math.round(totals.protein),
    fat: Math.round(totals.fat),
    updatedAt: new Date().toISOString()
  };

  try {
    await module.updateWidgetState(JSON.stringify(payload));
  } catch {
    // Widget sync should never interrupt logging.
  }
}
