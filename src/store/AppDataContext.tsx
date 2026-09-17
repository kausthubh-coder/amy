import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { normalizeMealLine } from "../domain/lines";
import { createId } from "../domain/seed";
import { targetsFromCalories } from "../domain/nutrition";
import { AmyLocalData, AppSettings, FoodCorrection, FoodDraft, FoodEntry, GoalProfile, SavedMeal, WeightLog } from "../domain/types";
import { addDays, toDateKey } from "../utils/date";
import { loadLocalData, onSaveResult, parseImportText, quarantineAndReset, saveLocalData, serializeExport } from "../storage/localDataStore";
import { syncAndroidWidgets } from "../services/androidWidgetSync";

const MAX_CORRECTIONS = 400;

type AddEntryOptions = {
  allowDuplicateNoteLine?: boolean;
  // Typed lines already exist in the note; capture flows need the line appended.
  appendNoteLine?: boolean;
};

export type ImportSummary = { entries: number; savedMeals: number; weightLogs: number; dropped: number };

type AppDataContextValue = {
  data: AmyLocalData | null;
  ready: boolean;
  loadError: string | null;
  saveError: string | null;
  today: string;
  selectedDay: string;
  setSelectedDay: (day: string) => void;
  shiftDay: (days: number) => void;
  goToToday: () => void;
  retryLoad: () => void;
  startFresh: () => Promise<void>;
  updateDayNote: (day: string, text: string) => void;
  completeOnboarding: (goal: Partial<GoalProfile>, settings?: Partial<AppSettings>) => void;
  updateGoal: (goal: Partial<GoalProfile>) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  addEntryFromDraft: (draft: FoodDraft, rawInput?: string, options?: AddEntryOptions) => FoodEntry;
  updateEntry: (entryId: string, patch: Partial<FoodEntry>) => void;
  deleteEntry: (entryId: string) => void;
  restoreEntry: (entry: FoodEntry, noteText?: string) => void;
  rememberFood: (line: string, food: Pick<FoodEntry, "title" | "servingLabel" | "macros" | "portion" | "items">) => void;
  forgetFood: (line: string) => void;
  logWeight: (day: string, weightLbs: number, note?: string) => void;
  addSavedMeal: (meal: Omit<SavedMeal, "id" | "createdAt">) => void;
  deleteSavedMeal: (mealId: string) => void;
  restoreSavedMeal: (meal: SavedMeal) => void;
  logSavedMeal: (mealId: string, day: string) => void;
  exportText: () => string;
  previewImport: (text: string) => ImportSummary;
  importText: (text: string) => ImportSummary;
};

type AppActions = Omit<AppDataContextValue, "data" | "ready" | "loadError" | "saveError" | "today" | "selectedDay">;

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
  if (existing?.text === text) return notes;
  return existing
    ? notes.map((note) => (note.day === day ? { ...note, text, updatedAt: nowIso() } : note))
    : [...notes, { day, text, updatedAt: nowIso() }];
}

function appendNoteLine(notes: AmyLocalData["dayNotes"], day: string, rawLine: string, options: { allowDuplicate?: boolean } = {}) {
  const line = rawLine.replace(/[\r\n]+/g, " ").trim();
  if (!line) return notes;
  const existing = notes.find((note) => note.day === day);
  const lines = (existing?.text ?? "")
    .split(/\r?\n/)
    .map((item) => item.trimEnd())
    .filter((item) => item.trim());
  if (!options.allowDuplicate && lines.some((item) => item.trim().toLowerCase() === line.toLowerCase())) return notes;
  return updateDayNotes(notes, day, [...lines, line].join("\n"));
}

function entryFromDraft(draft: FoodDraft, rawInput = draft.rawInput): FoodEntry {
  const timestamp = nowIso();
  return {
    id: createId("entry"),
    day: draft.day,
    rawInput: rawInput.replace(/[\r\n]+/g, " ").trim(),
    title: draft.title,
    servingLabel: draft.servingLabel,
    macros: draft.macros,
    source: draft.source,
    confidence: draft.confidence,
    sourceLabel: draft.sourceLabel,
    portion: draft.portion,
    barcode: draft.barcode,
    imageUri: draft.imageUri,
    items: draft.items,
    assumptions: draft.assumptions,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function upsertCorrection(list: FoodCorrection[], correction: FoodCorrection): FoodCorrection[] {
  const existing = list.find((item) => item.key === correction.key);
  const next = [{ ...correction, uses: (existing?.uses ?? 0) + 1 }, ...list.filter((item) => item.key !== correction.key)];
  return next.length > MAX_CORRECTIONS ? next.slice(0, MAX_CORRECTIONS) : next;
}

function summarize(data: AmyLocalData, dropped: number): ImportSummary {
  return { entries: data.entries.length, savedMeals: data.savedMeals.length, weightLogs: data.weightLogs.length, dropped };
}

export function LocalDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AmyLocalData | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [today, setToday] = useState(() => toDateKey(new Date()));
  const [selectedDay, setSelectedDay] = useState(today);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const dataRef = useRef<AmyLocalData | null>(null);
  const todayRef = useRef(today);

  useEffect(() => {
    let mounted = true;
    setLoadError(null);
    loadLocalData()
      .then((loaded) => {
        if (!mounted) return;
        dataRef.current = loaded;
        setData(loaded);
        setReady(true);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setLoadError(error instanceof Error ? error.message : "Amy could not read its saved data.");
        setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [loadAttempt]);

  useEffect(
    () =>
      onSaveResult((error) => {
        setSaveError(error ? "Amy could not save your last change. Free up storage, then edit anything to retry." : null);
      }),
    []
  );

  // Day rollover: an app left open past midnight must not keep logging to yesterday.
  useEffect(() => {
    const syncToday = () => {
      const next = toDateKey(new Date());
      if (next === todayRef.current) return;
      const previous = todayRef.current;
      todayRef.current = next;
      setToday(next);
      setSelectedDay((day) => (day === previous ? next : day));
    };
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncToday();
    });
    const timer = setInterval(syncToday, 30000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    void syncAndroidWidgets(data);
  }, [data, today]);

  const commit = useCallback((updater: (current: AmyLocalData) => AmyLocalData) => {
    const current = dataRef.current;
    if (!current) return;
    const next = updater(current);
    if (next === current) return;
    dataRef.current = next;
    setData(next);
    void saveLocalData(next);
  }, []);

  // Actions only depend on `commit`, so their identities stay stable across data changes.
  const actions = useMemo<AppActions>(
    () => ({
      setSelectedDay,
      shiftDay: (days: number) => setSelectedDay((day) => addDays(day, days)),
      goToToday: () => setSelectedDay(toDateKey(new Date())),
      retryLoad: () => {
        setReady(false);
        setLoadAttempt((attempt) => attempt + 1);
      },
      startFresh: async () => {
        const fresh = await quarantineAndReset();
        dataRef.current = fresh;
        setData(fresh);
        setLoadError(null);
      },
      updateDayNote: (day, text) =>
        commit((current) => {
          const dayNotes = updateDayNotes(current.dayNotes, day, text);
          return dayNotes === current.dayNotes ? current : { ...current, dayNotes, updatedAt: nowIso() };
        }),
      completeOnboarding: (goal, settings) =>
        commit((current) => {
          const dailyCalories = goal.dailyCalories ?? current.goal.dailyCalories;
          const currentWeightLbs = goal.currentWeightLbs ?? current.goal.currentWeightLbs;
          return {
            ...current,
            goal: { ...current.goal, ...targetsFromCalories(dailyCalories), ...goal, dailyCalories, currentWeightLbs },
            settings: { ...current.settings, ...settings, onboardingDone: true },
            weightLogs:
              current.weightLogs.length > 0 || currentWeightLbs <= 0
                ? current.weightLogs
                : [weightLogForDay(toDateKey(new Date()), currentWeightLbs, "Starting weight")],
            updatedAt: nowIso()
          };
        }),
      updateGoal: (goal) => commit((current) => ({ ...current, goal: { ...current.goal, ...goal }, updatedAt: nowIso() })),
      updateSettings: (settings) =>
        commit((current) => ({ ...current, settings: { ...current.settings, ...settings }, updatedAt: nowIso() })),
      addEntryFromDraft: (draft, rawInput, options) => {
        const entry = entryFromDraft(draft, rawInput);
        commit((current) => ({
          ...current,
          entries: [entry, ...current.entries],
          dayNotes:
            options?.appendNoteLine === false
              ? current.dayNotes
              : appendNoteLine(current.dayNotes, entry.day, entry.rawInput ?? entry.title, { allowDuplicate: options?.allowDuplicateNoteLine }),
          updatedAt: nowIso()
        }));
        return entry;
      },
      updateEntry: (entryId, patch) =>
        commit((current) => ({
          ...current,
          entries: current.entries.map((entry) => (entry.id === entryId ? { ...entry, ...patch, updatedAt: nowIso() } : entry)),
          updatedAt: nowIso()
        })),
      deleteEntry: (entryId) =>
        commit((current) => {
          const entries = current.entries.filter((entry) => entry.id !== entryId);
          return entries.length === current.entries.length ? current : { ...current, entries, updatedAt: nowIso() };
        }),
      restoreEntry: (entry, noteText) =>
        commit((current) => {
          if (current.entries.some((item) => item.id === entry.id)) return current;
          return {
            ...current,
            entries: [entry, ...current.entries],
            dayNotes:
              noteText !== undefined
                ? updateDayNotes(current.dayNotes, entry.day, noteText)
                : appendNoteLine(current.dayNotes, entry.day, entry.rawInput ?? entry.title, { allowDuplicate: true }),
            updatedAt: nowIso()
          };
        }),
      rememberFood: (line, food) =>
        commit((current) => {
          const key = normalizeMealLine(line);
          if (!key) return current;
          return {
            ...current,
            corrections: upsertCorrection(current.corrections, {
              key,
              title: food.title,
              servingLabel: food.servingLabel,
              macros: food.macros,
              portion: food.portion,
              items: food.items,
              uses: 0,
              updatedAt: nowIso()
            }),
            updatedAt: nowIso()
          };
        }),
      forgetFood: (line) =>
        commit((current) => {
          const key = normalizeMealLine(line);
          const corrections = current.corrections.filter((item) => item.key !== key);
          return corrections.length === current.corrections.length ? current : { ...current, corrections, updatedAt: nowIso() };
        }),
      logWeight: (day, weightLbs, note) =>
        commit((current) => {
          // One log per day: logging again replaces that day's value.
          const weightLogs = [weightLogForDay(day, weightLbs, note), ...current.weightLogs.filter((log) => log.day !== day)];
          const latest = weightLogs.slice().sort((a, b) => b.day.localeCompare(a.day))[0];
          return { ...current, goal: { ...current.goal, currentWeightLbs: latest?.weightLbs ?? weightLbs }, weightLogs, updatedAt: nowIso() };
        }),
      addSavedMeal: (meal) =>
        commit((current) => ({
          ...current,
          savedMeals: [{ ...meal, id: createId("saved"), createdAt: nowIso() }, ...current.savedMeals],
          updatedAt: nowIso()
        })),
      deleteSavedMeal: (mealId) =>
        commit((current) => ({ ...current, savedMeals: current.savedMeals.filter((meal) => meal.id !== mealId), updatedAt: nowIso() })),
      restoreSavedMeal: (meal) =>
        commit((current) =>
          current.savedMeals.some((item) => item.id === meal.id) ? current : { ...current, savedMeals: [meal, ...current.savedMeals], updatedAt: nowIso() }
        ),
      logSavedMeal: (mealId, day) =>
        commit((current) => {
          const meal = current.savedMeals.find((item) => item.id === mealId);
          if (!meal) return current;
          const timestamp = nowIso();
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
            createdAt: timestamp,
            updatedAt: timestamp
          };
          return {
            ...current,
            entries: [entry, ...current.entries],
            savedMeals: current.savedMeals.map((item) => (item.id === mealId ? { ...item, lastLoggedAt: timestamp } : item)),
            dayNotes: appendNoteLine(current.dayNotes, day, meal.title, { allowDuplicate: true }),
            updatedAt: timestamp
          };
        }),
      exportText: () => (dataRef.current ? serializeExport(dataRef.current) : ""),
      previewImport: (text) => {
        const report = parseImportText(text);
        return summarize(report.data, report.dropped);
      },
      importText: (text) => {
        const report = parseImportText(text);
        const current = dataRef.current;
        // Exports never contain the API key or folder grant, so keep the ones on this device.
        const imported: AmyLocalData = {
          ...report.data,
          settings: {
            ...report.data.settings,
            openRouterKey: report.data.settings.openRouterKey || current?.settings.openRouterKey || "",
            androidExportDirectoryUri: current?.settings.androidExportDirectoryUri
          }
        };
        dataRef.current = imported;
        setData(imported);
        void saveLocalData(imported);
        return summarize(imported, report.dropped);
      }
    }),
    [commit]
  );

  const value = useMemo<AppDataContextValue>(
    () => ({ data, ready, loadError, saveError, today, selectedDay, ...actions }),
    [actions, data, loadError, ready, saveError, selectedDay, today]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useAppData must be used inside LocalDataProvider");
  return value;
}
