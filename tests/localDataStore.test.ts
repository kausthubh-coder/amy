import assert from "node:assert/strict";
import { test } from "node:test";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { seedLocalData } from "../src/domain/seed";
import { loadLocalData, quarantineAndReset } from "../src/storage/localDataStore";
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
