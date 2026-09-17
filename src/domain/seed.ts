import { integrationConfig } from "../config/integrations";
import { toDateKey } from "../utils/date";
import { AmyLocalData } from "./types";
import { targetsFromCalories } from "./nutrition";

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

const now = () => new Date().toISOString();

export const DEFAULT_DAILY_CALORIES = 2000;

export function seedLocalData(): AmyLocalData {
  return {
    kind: "amy-local-data",
    schemaVersion: 1,
    goal: {
      dailyCalories: DEFAULT_DAILY_CALORIES,
      // 0 means "not set yet"; onboarding and Settings fill these in.
      currentWeightLbs: 0,
      weightGoalLbs: 0,
      ...targetsFromCalories(DEFAULT_DAILY_CALORIES)
    },
    settings: {
      onboardingDone: false,
      calorieBias: "balanced",
      appearance: "dark",
      locationForRestaurants: false,
      reminders: false,
      dictationLanguage: "auto",
      openRouterModel: integrationConfig.openRouter.defaultModel,
      openRouterKey: ""
    },
    entries: [],
    drafts: [],
    savedMeals: [],
    weightLogs: [],
    dayNotes: [{ day: toDateKey(new Date()), text: "", updatedAt: now() }],
    streakRepairs: [],
    corrections: [],
    updatedAt: now()
  };
}
