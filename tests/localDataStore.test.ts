import assert from "node:assert/strict";
import { test } from "node:test";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { seedLocalData } from "../src/domain/seed";
import { loadLocalData, parseImportText, quarantineAndReset, readRawStorage, saveLocalData, serializeExport } from "../src/storage/localDataStore";
import { splitIntoShards } from "../src/storage/migrate";

type StorageMethods = Pick<typeof AsyncStorage, "getItem" | "removeItem" | "getAllKeys" | "multiGet" | "multiSet" | "multiRemove" | "setItem">;

async function withStorageMock(run: (rows: Map<string, string>, fail: { multiSet: boolean; copiedRows: boolean }, removed: string[]) => Promise<void>) {
  const methods: StorageMethods = {
    getItem: AsyncStorage.getItem,
    removeItem: AsyncStorage.removeItem,
    getAllKeys: AsyncStorage.getAllKeys,
    multiGet: AsyncStorage.multiGet,
    multiSet: AsyncStorage.multiSet,
    multiRemove: AsyncStorage.multiRemove,
    setItem: AsyncStorage.setItem
  };
  const rows = new Map<string, string>();
  const fail = { multiSet: false, copiedRows: false };
  const removed: string[] = [];
  AsyncStorage.getItem = async (key) => rows.get(key) ?? null;
  AsyncStorage.removeItem = async (key) => {
    removed.push(key);
    rows.delete(key);
  };
  AsyncStorage.getAllKeys = async () => [...rows.keys()];
  AsyncStorage.multiGet = async (keys) => keys.map((key) => [key, fail.copiedRows && key.startsWith("@amy/quarantine/") ? null : (rows.get(key) ?? null)]);
  AsyncStorage.multiSet = async (pairs) => {
    if (fail.multiSet) throw new Error("disk full");
    pairs.forEach(([key, value]) => rows.set(key, value));
  };
  AsyncStorage.multiRemove = async (keys) => {
    removed.push(...keys);
    keys.forEach((key) => rows.delete(key));
  };
  AsyncStorage.setItem = async (key, value) => {
    rows.set(key, value);
  };
  try {
    await run(rows, fail, removed);
  } finally {
    Object.assign(AsyncStorage, methods);
  }
}

test("a missing month shard opens recovery without saving over the diary", async () => {
  await withStorageMock(async (rows, _, removed) => {
    const { meta } = splitIntoShards({
      ...seedLocalData(),
      entries: [{ id: "food-1", day: "2026-09-17", rawInput: "eggs", title: "Eggs", servingLabel: "2 eggs", macros: { calories: 140, carbs: 1, protein: 12, fat: 10 }, source: "manual", confidence: 1, createdAt: "2026-09-17T08:00:00Z", updatedAt: "2026-09-17T08:00:00Z" }]
    });
    const metaText = JSON.stringify(meta);
    rows.set("@amy/v2/meta", metaText);
    await assert.rejects(loadLocalData(), /missing/);
    assert.equal(rows.get("@amy/v2/meta"), metaText);
    assert.deepEqual(removed, []);
  });
});

test("an empty index does not turn a saved diary into a fresh one", async () => {
  await withStorageMock(async (rows, _, removed) => {
    rows.set("@amy/v2/meta", "");
    await assert.rejects(loadLocalData(), /damaged/);
    assert.equal(rows.get("@amy/v2/meta"), "");
    assert.deepEqual(removed, []);
  });
});

test("a malformed legacy record is kept for recovery", async () => {
  await withStorageMock(async (rows, _, removed) => {
    rows.set("@amy/local-data", "{}");
    await assert.rejects(loadLocalData(), /could not be migrated/);
    assert.equal(rows.get("@amy/local-data"), "{}");
    assert.deepEqual(removed, []);
  });
});

test("older diaries without weight logs still migrate", async () => {
  await withStorageMock(async (rows, _, removed) => {
    const { weightLogs: _weightLogs, ...olderDiary } = seedLocalData();
    rows.set("@amy/local-data", JSON.stringify(olderDiary));
    const loaded = await loadLocalData();
    assert.deepEqual(loaded.weightLogs, []);
    assert.equal(rows.has("@amy/v2/meta"), true);
    assert.deepEqual(removed, ["@amy/local-data"]);
  });
});

test("a failed shard write keeps the legacy diary", async () => {
  await withStorageMock(async (rows, fail, removed) => {
    const legacy = JSON.stringify({
      ...seedLocalData(),
      entries: [{ id: "food-1", day: "2026-09-17", rawInput: "eggs", title: "Eggs", servingLabel: "2 eggs", macros: { calories: 140, carbs: 1, protein: 12, fat: 10 }, source: "manual", confidence: 1, createdAt: "2026-09-17T08:00:00Z", updatedAt: "2026-09-17T08:00:00Z" }]
    });
    rows.set("@amy/local-data", legacy);
    fail.multiSet = true;
    await assert.rejects(loadLocalData(), /has not been deleted/);
    assert.equal(rows.get("@amy/local-data"), legacy);
    assert.deepEqual(removed, []);
  });
});

test("a failed quarantine copy never removes the original diary", async () => {
  await withStorageMock(async (rows, fail, removed) => {
    rows.set("@amy/local-data", "damaged raw diary");
    fail.multiSet = true;
    await assert.rejects(quarantineAndReset(), /disk full/);
    assert.equal(rows.get("@amy/local-data"), "damaged raw diary");
    assert.deepEqual(removed, []);
  });
});

test("an unverified quarantine copy never removes the original diary", async () => {
  await withStorageMock(async (rows, fail, removed) => {
    rows.set("@amy/local-data", "damaged raw diary");
    fail.copiedRows = true;
    await assert.rejects(quarantineAndReset(), /could not verify/);
    assert.equal(rows.get("@amy/local-data"), "damaged raw diary");
    assert.deepEqual(removed, []);
  });
});

test("the recovery copy of raw storage never contains the OpenRouter key", async () => {
  await withStorageMock(async (rows) => {
    const seed = seedLocalData();
    const { meta } = splitIntoShards({ ...seed, settings: { ...seed.settings, openRouterKey: "sk-or-v1-secret", androidExportDirectoryUri: "content://tree/Download" } });
    rows.set("@amy/v2/meta", JSON.stringify(meta));
    // A damaged (truncated) record still gets the key blanked, by text replacement.
    rows.set("@amy/quarantine/x/@amy/local-data", '{"kind":"amy-local-data","settings":{"openRouterKey":"sk-or-v1-secret"},');
    const raw = await readRawStorage();
    assert.equal(raw.includes("sk-or-v1-secret"), false);
    assert.equal(raw.includes("content://tree/Download"), false);
    // Everything else survives, so the copy is still a usable backup.
    assert.match(raw, /@amy\/v2\/meta/);
    assert.match(raw, /dailyCalories/);
    assert.match(raw, /@amy\/quarantine\/x/);
  });
});

test("an export with no data section is refused instead of becoming an empty diary", () => {
  assert.throws(() => parseImportText('{"kind":"amy-local-export"}'), /no Amy data section/);
  assert.throws(() => parseImportText('{"kind":"amy-local-export","data":null}'), /no Amy data section/);
  assert.throws(() => parseImportText("not json"), /not valid JSON/);
  const seed = seedLocalData();
  assert.equal(parseImportText(serializeExport({ ...seed, settings: { ...seed.settings, onboardingDone: true } })).data.settings.onboardingDone, true);
});

test("a save that follows a failed save reports the outcome of the newest write", async () => {
  await withStorageMock(async (rows, fail) => {
    const seed = seedLocalData();
    const diary = {
      ...seed,
      entries: [{ id: "food-9", day: "2026-09-18", rawInput: "toast", title: "Toast", servingLabel: "1 slice", macros: { calories: 80, carbs: 15, protein: 3, fat: 1 }, source: "manual" as const, confidence: 1, createdAt: "2026-09-18T08:00:00Z", updatedAt: "2026-09-18T08:00:00Z" }]
    };
    fail.multiSet = true;
    const first = saveLocalData(diary);
    fail.multiSet = false;
    const second = saveLocalData({ ...diary, updatedAt: "2026-09-18T08:00:01Z" });
    assert.deepEqual(await Promise.all([first, second]), [true, true]);
    assert.equal(rows.has("@amy/v2/month/2026-09"), true);
  });
});
