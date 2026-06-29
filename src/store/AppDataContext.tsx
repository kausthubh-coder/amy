import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { createId } from "../domain/seed";
import { targetsFromCalories } from "../domain/nutrition";
import { AmyLocalData, AppSettings, FoodDraft, FoodEntry, GoalProfile, SavedMeal, WeightLog } from "../domain/types";
import { addDays, toDateKey } from "../utils/date";
import { loadLocalData, parseImportText, saveLocalData, serializeExport } from "../storage/localDataStore";
import { syncAndroidWidgets } from "../services/androidWidgetSync";

type AddEntryOptions = {
  allowDuplicateNoteLine?: boolean;
};

type AppDataContextValue = {
  data: AmyLocalData | null;
  ready: boolean;
  selectedDay: string;
  setSelectedDay: (day: string) => void;
  shiftDay: (days: number) => void;
  updateDayNote: (day: string, text: string) => void;
  appendDayNoteLine: (day: string, text: string) => void;
  completeOnboarding: (goal: Partial<GoalProfile>) => void;
  updateGoal: (goal: Partial<GoalProfile>) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  addDrafts: (drafts: FoodDraft[]) => void;
  addEntryFromDraft: (draft: FoodDraft, rawInput?: string, options?: AddEntryOptions) => FoodEntry;
  confirmDraft: (draftId: string) => void;
  updateDraft: (draftId: string, patch: Partial<FoodDraft>) => void;
  updateEntry: (entryId: string, patch: Partial<FoodEntry>) => void;
  deleteEntry: (entryId: string) => void;
  logWeight: (day: string, weightLbs: number, note?: string) => void;
  addSavedMeal: (meal: Omit<SavedMeal, "id" | "createdAt">) => void;
  logSavedMeal: (mealId: string, day: string) => void;
  exportText: () => string;
  importText: (text: string) => void;
  resetDemo: () => void;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

function nowIso() {
  return new Date().toISOString();
}

function weightLogForDay(day: string, weightLbs: number, note?: string): WeightLog {
  const timestamp = nowIso();
  return {
    id: createId("weight"),
    day,
    weightLbs,
    note: note?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function updateDayNotes(notes: AmyLocalData["dayNotes"], day: string, text: string) {
  const existing = notes.find((note) => note.day === day);
  return existing
    ? notes.map((note) => (note.day === day ? { ...note, text, updatedAt: nowIso() } : note))
    : [...notes, { day, text, updatedAt: nowIso() }];
}

function appendNoteLine(notes: AmyLocalData["dayNotes"], day: string, rawLine: string, options: { allowDuplicate?: boolean } = {}) {
  const line = rawLine.trim();
  if (!line) return notes;
  const existing = notes.find((note) => note.day === day);
  const currentText = existing?.text ?? "";
  const lines = currentText
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!options.allowDuplicate && lines.some((item) => item.toLowerCase() === line.toLowerCase())) return notes;
  return updateDayNotes(notes, day, [...lines, line].join("\n"));
}

function draftKey(draft: FoodDraft) {
  return [
    draft.day,
    draft.rawInput.trim().toLowerCase().replace(/\s+/g, " "),
    draft.title.trim().toLowerCase().replace(/\s+/g, " "),
    draft.servingLabel.trim().toLowerCase().replace(/\s+/g, " "),
    draft.macros.calories,
    Math.round(draft.macros.carbs),
    Math.round(draft.macros.protein),
    Math.round(draft.macros.fat),
    draft.portion?.unit ?? "",
    draft.portion?.amount ?? ""
  ].join("|");
}

function cleanSourceLabel(source: FoodDraft["source"], label?: string) {
  let sourceLabel = label;
  if (source !== "open_food_facts" && /open food facts/i.test(sourceLabel ?? "")) {
    sourceLabel = source === "label_ocr" ? "Label estimate" : "Amy estimate";
  } else if (source === "ai_text") {
    sourceLabel = /menu|restaurant|chick-fil-a|mcdonald|taco bell|starbucks|chipotle/i.test(sourceLabel ?? "")
      ? "Restaurant estimate"
      : "Amy estimate";
  } else if (/usda|fatsecret|myfitnesspal|cronometer|nutritionix|common nutrition database|openrouter key|local estimate|local fallback/i.test(sourceLabel ?? "")) {
    sourceLabel = "Amy estimate";
  }
  return sourceLabel;
}

function normalizeDraft(draft: FoodDraft): FoodDraft {
  const sourceLabel = cleanSourceLabel(draft.source, draft.sourceLabel);
  return sourceLabel === draft.sourceLabel ? draft : { ...draft, sourceLabel };
}

function normalizeEntry(entry: FoodEntry): FoodEntry {
  const sourceLabel = cleanSourceLabel(entry.source, entry.sourceLabel);
  return sourceLabel === entry.sourceLabel ? entry : { ...entry, sourceLabel };
}

function entryFromDraft(draft: FoodDraft, rawInput = draft.rawInput): FoodEntry {
  return normalizeEntry({
    id: createId("entry"),
    day: draft.day,
    rawInput,
    title: draft.title,
    servingLabel: draft.servingLabel,
    macros: draft.macros,
    source: draft.source,
    confidence: draft.confidence,
    sourceLabel: draft.sourceLabel,
    portion: draft.portion,
    barcode: draft.barcode,
    imageUri: draft.imageUri,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });
}

function dedupeDrafts(drafts: FoodDraft[]) {
  const seen = new Set<string>();
  return drafts.map(normalizeDraft).filter((draft) => {
    const key = draftKey(draft);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeLocalData(loaded: AmyLocalData) {
  const drafts = dedupeDrafts(loaded.drafts);
  const entries = loaded.entries.map(normalizeEntry);
  const unchanged =
    drafts.length === loaded.drafts.length &&
    drafts.every((draft, index) => draft === loaded.drafts[index]) &&
    entries.every((entry, index) => entry === loaded.entries[index]);
  return unchanged ? loaded : { ...loaded, drafts, entries, updatedAt: nowIso() };
}

export function LocalDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AmyLocalData | null>(null);
  const [ready, setReady] = useState(false);
  const [selectedDay, setSelectedDay] = useState(toDateKey(new Date()));

  useEffect(() => {
    let mounted = true;
    loadLocalData().then((loaded) => {
      if (!mounted) return;
      const normalized = normalizeLocalData(loaded);
      setData(normalized);
      if (normalized !== loaded) void saveLocalData(normalized);
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    void syncAndroidWidgets(data);
  }, [data]);

  const commit = (updater: (current: AmyLocalData) => AmyLocalData) => {
    setData((current) => {
      if (!current) return current;
      const next = updater(current);
      void saveLocalData(next);
      return next;
    });
  };

  const value = useMemo<AppDataContextValue>(
    () => ({
      data,
      ready,
      selectedDay,
      setSelectedDay,
      shiftDay: (days) => setSelectedDay((day) => addDays(day, days)),
      updateDayNote: (day, text) =>
        commit((current) => {
          return { ...current, dayNotes: updateDayNotes(current.dayNotes, day, text), updatedAt: nowIso() };
        }),
      appendDayNoteLine: (day, text) =>
        commit((current) => {
          return { ...current, dayNotes: appendNoteLine(current.dayNotes, day, text), updatedAt: nowIso() };
        }),
      completeOnboarding: (goal) =>
        commit((current) => {
          const dailyCalories = goal.dailyCalories ?? current.goal.dailyCalories;
          const currentWeightLbs = goal.currentWeightLbs ?? current.goal.currentWeightLbs;
          return {
            ...current,
            goal: { ...current.goal, ...targetsFromCalories(dailyCalories), ...goal, dailyCalories, currentWeightLbs },
            settings: { ...current.settings, onboardingDone: true },
            weightLogs:
              current.weightLogs.length === 1 && current.weightLogs[0]?.id === "weight_initial"
                ? [{ ...current.weightLogs[0], day: selectedDay, weightLbs: currentWeightLbs, updatedAt: nowIso() }]
                : current.weightLogs.length > 0
                  ? current.weightLogs
                  : [weightLogForDay(selectedDay, currentWeightLbs, "Starting weight")],
            updatedAt: nowIso()
          };
        }),
      updateGoal: (goal) =>
        commit((current) => {
          const dailyCalories = goal.dailyCalories ?? current.goal.dailyCalories;
          return { ...current, goal: { ...current.goal, ...goal, dailyCalories }, updatedAt: nowIso() };
        }),
      updateSettings: (settings) =>
        commit((current) => ({ ...current, settings: { ...current.settings, ...settings }, updatedAt: nowIso() })),
      addDrafts: (drafts) =>
        commit((current) => {
          const currentDrafts = dedupeDrafts(current.drafts);
          const seen = new Set(currentDrafts.map(draftKey));
          const fresh = drafts.map(normalizeDraft).filter((draft) => {
            const key = draftKey(draft);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          if (!fresh.length && currentDrafts.length === current.drafts.length) return current;
          return { ...current, drafts: [...fresh, ...currentDrafts], updatedAt: nowIso() };
        }),
      updateDraft: (draftId, patch) =>
        commit((current) => ({
          ...current,
          drafts: current.drafts.map((draft) => (draft.id === draftId ? { ...draft, ...patch } : draft)),
          updatedAt: nowIso()
        })),
      addEntryFromDraft: (draft, rawInput, options) => {
        const entry = entryFromDraft(draft, rawInput);
        commit((current) => ({
          ...current,
          entries: [entry, ...current.entries],
          drafts: current.drafts.filter((item) => item.id !== draft.id),
          dayNotes: appendNoteLine(current.dayNotes, entry.day, entry.rawInput ?? entry.title, {
            allowDuplicate: options?.allowDuplicateNoteLine
          }),
          updatedAt: nowIso()
        }));
        return entry;
      },
      confirmDraft: (draftId) =>
        commit((current) => {
          const draft = current.drafts.find((item) => item.id === draftId);
          if (!draft) return current;
          const entry = entryFromDraft(draft);
          return {
            ...current,
            entries: [entry, ...current.entries],
            drafts: current.drafts.filter((item) => item.id !== draftId),
            dayNotes: appendNoteLine(current.dayNotes, draft.day, draft.rawInput),
            updatedAt: nowIso()
          };
        }),
      updateEntry: (entryId, patch) =>
        commit((current) => ({
          ...current,
          entries: current.entries.map((entry) =>
            entry.id === entryId ? normalizeEntry({ ...entry, ...patch, updatedAt: nowIso() }) : entry
          ),
          updatedAt: nowIso()
        })),
      deleteEntry: (entryId) =>
        commit((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== entryId), updatedAt: nowIso() })),
      logWeight: (day, weightLbs, note) =>
        commit((current) => ({
          ...current,
          goal: { ...current.goal, currentWeightLbs: weightLbs },
          weightLogs: [weightLogForDay(day, weightLbs, note), ...current.weightLogs],
          updatedAt: nowIso()
        })),
      addSavedMeal: (meal) =>
        commit((current) => ({
          ...current,
          savedMeals: [{ ...meal, id: createId("saved"), createdAt: nowIso() }, ...current.savedMeals],
          updatedAt: nowIso()
        })),
      logSavedMeal: (mealId, day) =>
        commit((current) => {
          const meal = current.savedMeals.find((item) => item.id === mealId);
          if (!meal) return current;
          const entry: FoodEntry = {
            id: createId("entry_saved"),
            day,
            rawInput: meal.title,
            title: meal.title,
            servingLabel: meal.servingLabel,
            macros: meal.macros,
            source: "saved_meal",
            confidence: 1,
            sourceLabel: "Saved meal",
            portion: meal.portion,
            createdAt: nowIso(),
            updatedAt: nowIso()
          };
          return {
            ...current,
            entries: [entry, ...current.entries],
            savedMeals: current.savedMeals.map((item) => (item.id === mealId ? { ...item, lastLoggedAt: nowIso() } : item)),
            dayNotes: appendNoteLine(current.dayNotes, day, meal.title, { allowDuplicate: true }),
            updatedAt: nowIso()
          };
        }),
      exportText: () => (data ? serializeExport(data) : ""),
      importText: (text) => {
        const imported = normalizeLocalData(parseImportText(text));
        setData(imported);
        void saveLocalData(imported);
      },
      resetDemo: () => {
        void loadLocalData().then((fresh) => setData(normalizeLocalData(fresh)));
      }
    }),
    [data, ready, selectedDay]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useAppData must be used inside LocalDataProvider");
  return value;
}
