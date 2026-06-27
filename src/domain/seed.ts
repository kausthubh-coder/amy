import { integrationConfig } from "../config/integrations";
import { toDateKey } from "../utils/date";
import { AmyLocalData, SavedMeal } from "./types";
import { targetsFromCalories } from "./nutrition";

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

const now = () => new Date().toISOString();

const defaultCalories = 2632;

const savedMeals: SavedMeal[] = [
  {
    id: "saved_chicken_sandwich",
    title: "Chick-fil-A sandwich meal",
    servingLabel: "1 meal",
    macros: { calories: 1150, carbs: 102, protein: 33, fat: 69 },
    createdAt: now()
  },
  {
    id: "saved_eggs_toast",
    title: "Two eggs and toast",
    servingLabel: "1 plate",
    macros: { calories: 390, carbs: 34, protein: 22, fat: 18 },
    createdAt: now()
  }
];

export function seedLocalData(): AmyLocalData {
  return {
    kind: "amy-local-data",
    schemaVersion: 1,
    goal: {
      dailyCalories: defaultCalories,
      currentWeightLbs: 218,
      weightGoalLbs: 154,
      ...targetsFromCalories(defaultCalories)
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
    savedMeals,
    weightLogs: [
      {
        id: "weight_initial",
        day: toDateKey(new Date()),
        weightLbs: 218,
        note: "Starting weight",
        createdAt: now(),
        updatedAt: now()
      }
    ],
    dayNotes: [{ day: toDateKey(new Date()), text: "", updatedAt: now() }],
    streakRepairs: [],
    updatedAt: now()
  };
}
