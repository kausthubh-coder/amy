export type MacroTotals = {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
};

export type FoodSource = "ai_text" | "ai_photo" | "label_ocr" | "open_food_facts" | "saved_meal" | "manual" | "local_fallback";

export type FoodEntry = {
  id: string;
  day: string;
  rawInput?: string;
  title: string;
  servingLabel: string;
  macros: MacroTotals;
  source: FoodSource;
  confidence: number;
  sourceLabel?: string;
  barcode?: string;
  imageUri?: string;
  createdAt: string;
  updatedAt: string;
};

export type FoodDraft = {
  id: string;
  day: string;
  rawInput: string;
  title: string;
  servingLabel: string;
  macros: MacroTotals;
  source: FoodSource;
  confidence: number;
  sourceLabel?: string;
  barcode?: string;
  imageUri?: string;
  createdAt: string;
};

export type SavedMeal = {
  id: string;
  title: string;
  servingLabel: string;
  macros: MacroTotals;
  lastLoggedAt?: string;
  createdAt: string;
};

export type WeightLog = {
  id: string;
  day: string;
  weightLbs: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type GoalProfile = {
  dailyCalories: number;
  weightGoalLbs: number;
  currentWeightLbs: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
};

export type AppSettings = {
  onboardingDone: boolean;
  calorieBias: "under_more" | "under" | "balanced" | "over" | "over_more";
  appearance: "system" | "dark" | "light";
  locationForRestaurants: boolean;
  reminders: boolean;
  dictationLanguage: string;
  openRouterModel: string;
  openRouterKey: string;
};

export type DayNote = {
  day: string;
  text: string;
  updatedAt: string;
};

export type AmyLocalData = {
  kind: "amy-local-data";
  schemaVersion: 1;
  goal: GoalProfile;
  settings: AppSettings;
  entries: FoodEntry[];
  drafts: FoodDraft[];
  savedMeals: SavedMeal[];
  weightLogs: WeightLog[];
  dayNotes: DayNote[];
  streakRepairs: string[];
  updatedAt: string;
};

export type AmyExportBundle = {
  kind: "amy-local-export";
  schemaVersion: 1;
  exportedAt: string;
  data: AmyLocalData;
};
