import { seedLocalData } from "../domain/seed";
import {
  AmyLocalData,
  AppSettings,
  DayNote,
  FoodCorrection,
  FoodDraft,
  FoodEntry,
  FoodItem,
  FoodPortion,
  FoodSource,
  GoalProfile,
  MacroTotals,
  SavedMeal,
  WeightLog
} from "../domain/types";

// Pure validation for anything read from disk or pasted by the user. One malformed record must
// never be able to crash rendering, so every collection is checked item by item.

export const SCHEMA_VERSION = 1;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SOURCES: FoodSource[] = ["ai_text", "ai_photo", "label_ocr", "open_food_facts", "saved_meal", "manual", "local_fallback"];
const BIASES: AppSettings["calorieBias"][] = ["under_more", "under", "balanced", "over", "over_more"];

export type MigrationReport = { data: AmyLocalData; dropped: number };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nonNegative(value: unknown, fallback = 0): number {
  return Math.max(0, finite(value, fallback));
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isoOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

export function sanitizeMacros(value: unknown): MacroTotals {
  const raw = isRecord(value) ? value : {};
  return {
    calories: Math.round(nonNegative(raw.calories)),
    carbs: nonNegative(raw.carbs),
    protein: nonNegative(raw.protein),
    fat: nonNegative(raw.fat)
  };
}

function sanitizePortion(value: unknown): FoodPortion | undefined {
  if (!isRecord(value)) return undefined;
  const amount = finite(value.amount, Number.NaN);
  const baseAmount = finite(value.baseAmount, Number.NaN);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(baseAmount) || baseAmount <= 0) return undefined;
  const servingGrams = finite(value.servingGrams, 0);
  return {
    amount,
    unit: value.unit === "g" ? "g" : "serving",
    servingLabel: str(value.servingLabel) ?? "1 serving",
    servingGrams: servingGrams > 0 ? servingGrams : undefined,
    baseAmount,
    baseUnit: value.baseUnit === "g" ? "g" : "serving",
    baseMacros: sanitizeMacros(value.baseMacros)
  };
}

function sanitizeItems(value: unknown): FoodItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter(isRecord).map((raw) => {
    const grams = finite(raw.grams, 0);
    return {
      title: str(raw.title)?.trim() || "Food",
      servingLabel: str(raw.servingLabel) ?? "1 serving",
      grams: grams > 0 ? grams : undefined,
      macros: sanitizeMacros(raw.macros),
      confidence: Math.min(1, nonNegative(raw.confidence, 0.6))
    };
  });
  return items.length ? items : undefined;
}

function sanitizeFood(raw: Record<string, unknown>, now: string) {
  const id = str(raw.id);
  const day = str(raw.day);
  const title = str(raw.title)?.trim() || str(raw.rawInput)?.trim();
  if (!id || !day || !DAY_PATTERN.test(day) || !title) return null;
  return {
    id,
    day,
    title,
    servingLabel: str(raw.servingLabel) ?? "1 serving",
    macros: sanitizeMacros(raw.macros),
    source: SOURCES.includes(raw.source as FoodSource) ? (raw.source as FoodSource) : "manual",
    confidence: Math.min(1, nonNegative(raw.confidence, 0.6)),
    sourceLabel: str(raw.sourceLabel),
    portion: sanitizePortion(raw.portion),
    barcode: str(raw.barcode),
    imageUri: str(raw.imageUri),
    items: sanitizeItems(raw.items),
    assumptions: str(raw.assumptions),
    createdAt: isoOr(raw.createdAt, now)
  };
}

function sanitizeEntry(raw: unknown, now: string): FoodEntry | null {
  if (!isRecord(raw)) return null;
  const food = sanitizeFood(raw, now);
  if (!food) return null;
  return { ...food, rawInput: str(raw.rawInput), userEdited: raw.userEdited === true ? true : undefined, updatedAt: isoOr(raw.updatedAt, food.createdAt) };
}

function sanitizeDraft(raw: unknown, now: string): FoodDraft | null {
  if (!isRecord(raw)) return null;
  const food = sanitizeFood(raw, now);
  return food ? { ...food, rawInput: str(raw.rawInput) ?? food.title } : null;
}

function sanitizeSavedMeal(raw: unknown, now: string): SavedMeal | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id);
  const title = str(raw.title)?.trim();
  if (!id || !title) return null;
  return {
    id,
    title,
    servingLabel: str(raw.servingLabel) ?? "1 serving",
    macros: sanitizeMacros(raw.macros),
    portion: sanitizePortion(raw.portion),
    lastLoggedAt: str(raw.lastLoggedAt),
    createdAt: isoOr(raw.createdAt, now)
  };
}

function sanitizeWeightLog(raw: unknown, now: string): WeightLog | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id);
  const day = str(raw.day);
  const weightLbs = finite(raw.weightLbs, 0);
  if (!id || !day || !DAY_PATTERN.test(day) || weightLbs <= 0) return null;
  return { id, day, weightLbs, note: str(raw.note), createdAt: isoOr(raw.createdAt, now), updatedAt: isoOr(raw.updatedAt, now) };
}

function sanitizeDayNote(raw: unknown, now: string): DayNote | null {
  if (!isRecord(raw)) return null;
  const day = str(raw.day);
  if (!day || !DAY_PATTERN.test(day)) return null;
  return { day, text: str(raw.text) ?? "", updatedAt: isoOr(raw.updatedAt, now) };
}

function sanitizeCorrection(raw: unknown, now: string): FoodCorrection | null {
  if (!isRecord(raw)) return null;
  const key = str(raw.key)?.trim();
  if (!key) return null;
  return {
    key,
    title: str(raw.title)?.trim() || key,
    servingLabel: str(raw.servingLabel) ?? "1 serving",
    macros: sanitizeMacros(raw.macros),
    portion: sanitizePortion(raw.portion),
    items: sanitizeItems(raw.items),
    uses: Math.max(1, Math.round(finite(raw.uses, 1))),
    updatedAt: isoOr(raw.updatedAt, now)
  };
}

function sanitizeList<T>(value: unknown, fallback: T[], sanitize: (raw: unknown, now: string) => T | null, now: string, report: { dropped: number }): T[] {
  if (!Array.isArray(value)) return fallback;
  const result: T[] = [];
  value.forEach((raw) => {
    const item = sanitize(raw, now);
    if (item) result.push(item);
    else report.dropped += 1;
  });
  return result;
}

function uniqueBy<T>(list: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const id = key(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function sanitizeGoal(value: unknown, fallback: GoalProfile): GoalProfile {
  const raw = isRecord(value) ? value : {};
  const dailyCalories = Math.round(finite(raw.dailyCalories, fallback.dailyCalories));
  return {
    dailyCalories: dailyCalories > 0 ? dailyCalories : fallback.dailyCalories,
    weightGoalLbs: nonNegative(raw.weightGoalLbs, fallback.weightGoalLbs),
    currentWeightLbs: nonNegative(raw.currentWeightLbs, fallback.currentWeightLbs),
    proteinTarget: Math.round(nonNegative(raw.proteinTarget, fallback.proteinTarget)),
    carbsTarget: Math.round(nonNegative(raw.carbsTarget, fallback.carbsTarget)),
    fatTarget: Math.round(nonNegative(raw.fatTarget, fallback.fatTarget))
  };
}

function sanitizeSettings(value: unknown, fallback: AppSettings): AppSettings {
  const raw = isRecord(value) ? value : {};
  const bool = (input: unknown, base: boolean) => (typeof input === "boolean" ? input : base);
  return {
    onboardingDone: bool(raw.onboardingDone, fallback.onboardingDone),
    calorieBias: BIASES.includes(raw.calorieBias as AppSettings["calorieBias"]) ? (raw.calorieBias as AppSettings["calorieBias"]) : fallback.calorieBias,
    appearance: raw.appearance === "light" || raw.appearance === "system" ? raw.appearance : "dark",
    locationForRestaurants: bool(raw.locationForRestaurants, fallback.locationForRestaurants),
    reminders: bool(raw.reminders, fallback.reminders),
    dictationLanguage: str(raw.dictationLanguage) || fallback.dictationLanguage,
    openRouterModel: str(raw.openRouterModel)?.trim() || fallback.openRouterModel,
    openRouterKey: str(raw.openRouterKey) ?? "",
    androidExportDirectoryUri: str(raw.androidExportDirectoryUri)
  };
}

export function migrateWithReport(input: unknown): MigrationReport {
  const fallback = seedLocalData();
  const raw = isRecord(input) && input.kind === "amy-local-export" ? input.data : input;
  if (!isRecord(raw)) return { data: fallback, dropped: 0 };

  const now = new Date().toISOString();
  const report = { dropped: 0 };
  const data: AmyLocalData = {
    kind: "amy-local-data",
    schemaVersion: SCHEMA_VERSION,
    goal: sanitizeGoal(raw.goal, fallback.goal),
    settings: sanitizeSettings(raw.settings, fallback.settings),
    entries: uniqueBy(sanitizeList(raw.entries, fallback.entries, sanitizeEntry, now, report), (entry) => entry.id),
    drafts: uniqueBy(sanitizeList(raw.drafts, fallback.drafts, sanitizeDraft, now, report), (draft) => draft.id),
    savedMeals: uniqueBy(sanitizeList(raw.savedMeals, fallback.savedMeals, sanitizeSavedMeal, now, report), (meal) => meal.id),
    weightLogs: uniqueBy(sanitizeList(raw.weightLogs, fallback.weightLogs, sanitizeWeightLog, now, report), (log) => log.id),
    dayNotes: uniqueBy(sanitizeList(raw.dayNotes, fallback.dayNotes, sanitizeDayNote, now, report), (note) => note.day),
    streakRepairs: Array.isArray(raw.streakRepairs) ? raw.streakRepairs.filter((item): item is string => typeof item === "string") : [],
    corrections: uniqueBy(sanitizeList(raw.corrections, [], sanitizeCorrection, now, report), (item) => item.key),
    updatedAt: isoOr(raw.updatedAt, now)
  };
  return { data, dropped: report.dropped };
}

export function migrateLocalData(input: unknown): AmyLocalData {
  return migrateWithReport(input).data;
}

/** Splits the diary into small per-month records so no single storage row can outgrow Android's limits. */
export function monthOf(day: string) {
  return DAY_PATTERN.test(day) ? day.slice(0, 7) : "undated";
}

export type MonthShard = { entries: FoodEntry[]; dayNotes: DayNote[] };

export function splitIntoShards(data: AmyLocalData): { meta: Omit<AmyLocalData, "entries" | "dayNotes"> & { months: string[] }; months: Record<string, MonthShard> } {
  const months: Record<string, MonthShard> = {};
  const shard = (month: string) => (months[month] ??= { entries: [], dayNotes: [] });
  data.entries.forEach((entry) => shard(monthOf(entry.day)).entries.push(entry));
  data.dayNotes.forEach((note) => {
    if (note.text.trim() || months[monthOf(note.day)]) shard(monthOf(note.day)).dayNotes.push(note);
  });
  const { entries: _entries, dayNotes: _dayNotes, ...rest } = data;
  return { meta: { ...rest, months: Object.keys(months).sort() }, months };
}

export function joinShards(meta: unknown, months: unknown[]): MigrationReport {
  const base = isRecord(meta) ? meta : {};
  const entries: unknown[] = [];
  const dayNotes: unknown[] = [];
  months.forEach((month) => {
    if (!isRecord(month)) return;
    if (Array.isArray(month.entries)) entries.push(...month.entries);
    if (Array.isArray(month.dayNotes)) dayNotes.push(...month.dayNotes);
  });
  const report = migrateWithReport({ ...base, entries, dayNotes });
  report.data.entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return report;
}
