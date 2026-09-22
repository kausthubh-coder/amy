export type MacroTotals = {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
};

export type PortionUnit = "serving" | "g";

export type FoodPortion = {
  amount: number;
  unit: PortionUnit;
  servingLabel: string;
  servingGrams?: number;
  baseAmount: number;
  baseUnit: PortionUnit;
  baseMacros: MacroTotals;
};

export type FoodSource = "ai_text" | "ai_photo" | "label_ocr" | "open_food_facts" | "saved_meal" | "manual" | "local_fallback";

export type FoodItem = {
  title: string;
  servingLabel: string;
  grams?: number;
  macros: MacroTotals;
  confidence: number;
};

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
  portion?: FoodPortion;
  barcode?: string;
  imageUri?: string;
  items?: FoodItem[];
  assumptions?: string;
  userEdited?: boolean;
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
  portion?: FoodPortion;
  barcode?: string;
  imageUri?: string;
  items?: FoodItem[];
  assumptions?: string;
  createdAt: string;
};

export type SavedMeal = {
  id: string;
  title: string;
  servingLabel: string;
  macros: MacroTotals;
  portion?: FoodPortion;
  lastLoggedAt?: string;
  createdAt: string;
};

// What the user last confirmed for a given log line, so repeat foods skip the network.
export type FoodCorrection = {
  key: string;
  title: string;
  servingLabel: string;
  macros: MacroTotals;
  portion?: FoodPortion;
  items?: FoodItem[];
  uses: number;
  updatedAt: string;
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

export type CalorieBias = "under_more" | "under" | "balanced" | "over" | "over_more";

export type AppSettings = {
  onboardingDone: boolean;
  calorieBias: CalorieBias;
  appearance: "system" | "dark" | "light";
  locationForRestaurants: boolean;
  reminders: boolean;
  dictationLanguage: string;
  openRouterModel: string;
  openRouterKey: string;
  androidExportDirectoryUri?: string;
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
  corrections: FoodCorrection[];
  updatedAt: string;
};

export type AmyExportBundle = {
  kind: "amy-local-export";
  schemaVersion: 1;
  exportedAt: string;
  data: AmyLocalData;
};
