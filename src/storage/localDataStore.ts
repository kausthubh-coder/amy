import AsyncStorage from "@react-native-async-storage/async-storage";

import { AmyExportBundle, AmyLocalData } from "../domain/types";
import { seedLocalData } from "../domain/seed";
import { isRecord, joinShards, migrateLocalData, migrateWithReport, MigrationReport, SCHEMA_VERSION, splitIntoShards } from "./migrate";

export { migrateLocalData } from "./migrate";

// Storage layout (v2): one small meta record plus one record per calendar month. The original
// single-blob key would eventually exceed Android's ~2 MB per-row read limit and brick the app.
const LEGACY_KEY = "@amy/local-data";
const META_KEY = "@amy/v2/meta";
const MONTH_PREFIX = "@amy/v2/month/";
const QUARANTINE_PREFIX = "@amy/quarantine/";

export class StorageLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageLoadError";
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

// Last value written per key, so a save only touches the shards that changed.
const written = new Map<string, string>();

function parseOrThrow(key: string, value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new StorageLoadError(`Saved data under ${key} is damaged and could not be read.`);
  }
}

async function loadSharded(metaText: string): Promise<AmyLocalData> {
  const meta = parseOrThrow(META_KEY, metaText);
  if (
    !isRecord(meta) || meta.kind !== "amy-local-data" || !isRecord(meta.goal) || !isRecord(meta.settings) ||
    !Array.isArray(meta.drafts) || !Array.isArray(meta.savedMeals) || !Array.isArray(meta.weightLogs) ||
    !Array.isArray(meta.streakRepairs) || !Array.isArray(meta.corrections) ||
    !Array.isArray(meta.months) || !meta.months.every((month) => typeof month === "string" && /^(?:\d{4}-\d{2}|undated)$/.test(month))
  ) {
    throw new StorageLoadError("The saved diary index is damaged and could not be read.");
  }
  const monthNames: string[] = meta.months;
  const pairs = monthNames.length ? await AsyncStorage.multiGet(monthNames.map((month) => `${MONTH_PREFIX}${month}`)) : [];
  const rows = new Map(pairs);
  const months = monthNames.map((month) => {
    const key = `${MONTH_PREFIX}${month}`;
    const value = rows.get(key);
    if (value == null) throw new StorageLoadError(`Saved data under ${key} is missing. Nothing has been overwritten.`);
    const shard = parseOrThrow(key, value);
    if (!isRecord(shard) || !Array.isArray(shard.entries) || !Array.isArray(shard.dayNotes)) {
      throw new StorageLoadError(`Saved data under ${key} is damaged and could not be read.`);
    }
    written.set(key, value);
    return shard;
  });
  written.set(META_KEY, metaText);
  return joinShards(meta, months).data;
}

/**
 * Loads the diary. Never replaces unreadable data with a fresh seed: damaged storage raises
 * StorageLoadError so the UI can offer a raw export before anything is overwritten.
 */
export async function loadLocalData(): Promise<AmyLocalData> {
  const metaText = await AsyncStorage.getItem(META_KEY);
  if (metaText !== null) return loadSharded(metaText);

  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (legacy !== null) {
    const raw = parseOrThrow(LEGACY_KEY, legacy);
    if (
      !isRecord(raw) || raw.kind !== "amy-local-data" || !isRecord(raw.goal) || !isRecord(raw.settings) ||
      !Array.isArray(raw.entries) || !Array.isArray(raw.dayNotes)
    ) {
      throw new StorageLoadError("The old diary is damaged and could not be migrated. It has not been deleted.");
    }
    const migrated = migrateLocalData(raw);
    if (!(await saveLocalData(migrated))) {
      throw new StorageLoadError("The old diary could not be copied to the new storage layout. It has not been deleted.");
    }
    await AsyncStorage.removeItem(LEGACY_KEY);
    return migrated;
  }

  const fresh = seedLocalData();
  if (!(await saveLocalData(fresh))) throw new StorageLoadError("Amy could not save a new diary. Free up storage and try again.");
  return fresh;
}

async function writeShards(data: AmyLocalData): Promise<void> {
  const { meta, months } = splitIntoShards({ ...data, updatedAt: nowIso() });
  const next = new Map<string, string>();
  Object.entries(months).forEach(([month, shard]) => next.set(`${MONTH_PREFIX}${month}`, JSON.stringify(shard)));

  const changed: [string, string][] = [];
  next.forEach((value, key) => {
    if (written.get(key) !== value) changed.push([key, value]);
  });
  const removed = Array.from(written.keys()).filter((key) => key.startsWith(MONTH_PREFIX) && !next.has(key));

  // Months first, meta last: meta lists the months, so a crash mid-save never points at missing rows.
  if (changed.length) await AsyncStorage.multiSet(changed);
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
  if (removed.length) await AsyncStorage.multiRemove(removed);

  changed.forEach(([key, value]) => written.set(key, value));
  removed.forEach((key) => written.delete(key));
}

type SaveListener = (error: Error | null) => void;
const saveListeners = new Set<SaveListener>();
let pending: AmyLocalData | null = null;
let flushing: Promise<boolean> | null = null;

export function onSaveResult(listener: SaveListener) {
  saveListeners.add(listener);
  return () => {
    saveListeners.delete(listener);
  };
}

async function flush(): Promise<boolean> {
  let saved = true;
  while (pending) {
    const data = pending;
    pending = null;
    try {
      await writeShards(data);
      saveListeners.forEach((listener) => listener(null));
    } catch (error) {
      saved = false;
      const failure = error instanceof Error ? error : new Error("Saving failed.");
      // Failures surface through listeners (the UI shows a banner); the next edit retries the save.
      saveListeners.forEach((listener) => listener(failure));
    }
  }
  return saved;
}

/** Queues a save. Writes are serialized and coalesced, so rapid edits only persist the latest state. */
export function saveLocalData(data: AmyLocalData): Promise<boolean> {
  pending = data;
  if (!flushing) {
    flushing = flush().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

/** Everything Amy has stored, as text, for the recovery screen. */
export async function readRawStorage(): Promise<string> {
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith("@amy/"));
  const pairs = await AsyncStorage.multiGet(keys);
  return JSON.stringify(Object.fromEntries(pairs), null, 2);
}

/** Moves damaged records aside (never deletes them) and starts a fresh diary. */
export async function quarantineAndReset(): Promise<AmyLocalData> {
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith("@amy/") && !key.startsWith(QUARANTINE_PREFIX));
  const pairs = await AsyncStorage.multiGet(keys);
  const originals = new Map(pairs);
  if (keys.some((key) => originals.get(key) == null)) {
    throw new StorageLoadError("Amy could not read every original record, so the diary was left in place.");
  }
  const stamp = Date.now().toString(36);
  const moved = keys.map((key): [string, string] => [`${QUARANTINE_PREFIX}${stamp}/${key}`, originals.get(key)!]);
  if (moved.length) {
    await AsyncStorage.multiSet(moved);
    const copies = new Map(await AsyncStorage.multiGet(moved.map(([key]) => key)));
    if (moved.some(([key, value]) => copies.get(key) !== value)) {
      throw new StorageLoadError("Amy could not verify the backup copy, so the original diary was left in place.");
    }
  }
  await AsyncStorage.multiRemove(keys);
  written.clear();
  const fresh = seedLocalData();
  if (!(await saveLocalData(fresh))) throw new StorageLoadError("The old diary was quarantined, but Amy could not save a new one. Free up storage and try again.");
  return fresh;
}

function exportableData(data: AmyLocalData): AmyLocalData {
  return {
    ...data,
    settings: {
      ...data.settings,
      openRouterKey: "",
      androidExportDirectoryUri: undefined
    }
  };
}

export function buildExportBundle(data: AmyLocalData): AmyExportBundle {
  return {
    kind: "amy-local-export",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    data: { ...exportableData(data), schemaVersion: SCHEMA_VERSION, updatedAt: nowIso() }
  };
}

export function serializeExport(data: AmyLocalData): string {
  return JSON.stringify(buildExportBundle(data), null, 2);
}

export function parseImportText(text: string): MigrationReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That is not valid JSON. Paste a full Amy export.");
  }
  if (!isRecord(parsed) || parsed.kind !== "amy-local-export") {
    throw new Error("Import must be an Amy JSON export.");
  }
  return migrateWithReport(parsed);
}
