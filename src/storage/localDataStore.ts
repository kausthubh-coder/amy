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
  const monthNames = isRecord(meta) && Array.isArray(meta.months) ? meta.months.filter((item): item is string => typeof item === "string") : [];
  const pairs = monthNames.length ? await AsyncStorage.multiGet(monthNames.map((month) => `${MONTH_PREFIX}${month}`)) : [];
  const months = pairs.map(([key, value]) => {
    if (value == null) return {};
    written.set(key, value);
    return parseOrThrow(key, value);
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
  if (metaText) return loadSharded(metaText);

  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (legacy) {
    const migrated = migrateLocalData(parseOrThrow(LEGACY_KEY, legacy));
    await saveLocalData(migrated);
    await AsyncStorage.removeItem(LEGACY_KEY);
    return migrated;
  }

  const fresh = seedLocalData();
  await saveLocalData(fresh);
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
let flushing: Promise<void> | null = null;

export function onSaveResult(listener: SaveListener) {
  saveListeners.add(listener);
  return () => {
    saveListeners.delete(listener);
  };
}

async function flush(): Promise<void> {
  while (pending) {
    const data = pending;
    pending = null;
    try {
      await writeShards(data);
      saveListeners.forEach((listener) => listener(null));
    } catch (error) {
      const failure = error instanceof Error ? error : new Error("Saving failed.");
      // Failures surface through listeners (the UI shows a banner); the next edit retries the save.
      saveListeners.forEach((listener) => listener(failure));
    }
  }
}

/** Queues a save. Writes are serialized and coalesced, so rapid edits only persist the latest state. */
export function saveLocalData(data: AmyLocalData): Promise<void> {
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
  const stamp = Date.now().toString(36);
  const moved = pairs.filter((pair): pair is [string, string] => pair[1] != null).map(([key, value]): [string, string] => [`${QUARANTINE_PREFIX}${stamp}/${key}`, value]);
  if (moved.length) await AsyncStorage.multiSet(moved).catch(() => undefined);
  await AsyncStorage.multiRemove(keys);
  written.clear();
  const fresh = seedLocalData();
  await saveLocalData(fresh);
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
