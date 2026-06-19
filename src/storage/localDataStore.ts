import AsyncStorage from "@react-native-async-storage/async-storage";

import { AmyExportBundle, AmyLocalData } from "../domain/types";
import { seedLocalData } from "../domain/seed";

const STORAGE_KEY = "@amy/local-data";
const SCHEMA_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function migrateLocalData(input: unknown): AmyLocalData {
  const fallback = seedLocalData();
  const raw = isRecord(input) && input.kind === "amy-local-export" ? input.data : input;

  if (!isRecord(raw)) return fallback;

  return {
    ...fallback,
    ...raw,
    kind: "amy-local-data",
    schemaVersion: SCHEMA_VERSION,
    goal: {
      ...fallback.goal,
      ...(isRecord(raw.goal) ? raw.goal : {})
    },
    settings: {
      ...fallback.settings,
      ...(isRecord(raw.settings) ? raw.settings : {})
    },
    entries: Array.isArray(raw.entries) ? raw.entries : fallback.entries,
    drafts: Array.isArray(raw.drafts) ? raw.drafts : fallback.drafts,
    savedMeals: Array.isArray(raw.savedMeals) ? raw.savedMeals : fallback.savedMeals,
    dayNotes: Array.isArray(raw.dayNotes) ? raw.dayNotes : fallback.dayNotes,
    streakRepairs: Array.isArray(raw.streakRepairs) ? raw.streakRepairs : fallback.streakRepairs,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso()
  };
}

export async function loadLocalData(): Promise<AmyLocalData> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const fresh = seedLocalData();
    await saveLocalData(fresh);
    return fresh;
  }

  try {
    return migrateLocalData(JSON.parse(stored));
  } catch {
    const fresh = seedLocalData();
    await saveLocalData(fresh);
    return fresh;
  }
}

export async function saveLocalData(data: AmyLocalData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, updatedAt: nowIso() }));
}

export function buildExportBundle(data: AmyLocalData): AmyExportBundle {
  return {
    kind: "amy-local-export",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    data: { ...data, schemaVersion: SCHEMA_VERSION, updatedAt: nowIso() }
  };
}

export function serializeExport(data: AmyLocalData): string {
  return JSON.stringify(buildExportBundle(data), null, 2);
}

export function parseImportText(text: string): AmyLocalData {
  const parsed = JSON.parse(text);
  if (!isRecord(parsed) || parsed.kind !== "amy-local-export") {
    throw new Error("Import must be an Amy JSON export.");
  }
  return migrateLocalData(parsed);
}
