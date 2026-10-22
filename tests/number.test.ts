import assert from "node:assert/strict";
import { test } from "node:test";

import { compareIso, parseUserNumber } from "../src/utils/number";

test("numbers typed with thousands separators or comma decimals read as people mean them", () => {
  assert.equal(parseUserNumber("1,200"), 1200);
  assert.equal(parseUserNumber("1.200"), 1200);
  assert.equal(parseUserNumber("2,000"), 2000);
  assert.equal(parseUserNumber("12,5"), 12.5);
  assert.equal(parseUserNumber("12.5"), 12.5);
  assert.equal(parseUserNumber("0,5"), 0.5);
  assert.equal(parseUserNumber("1,200.5"), 1200.5);
  assert.equal(parseUserNumber(" 190 "), 190);
  assert.equal(parseUserNumber("abc"), undefined);
  assert.equal(parseUserNumber(""), undefined);
});

test("ISO days and timestamps sort as plain strings", () => {
  assert.equal(compareIso("2026-09-17T08:00:00Z", "2026-09-17T09:00:00Z"), -1);
  assert.equal(compareIso("2026-09-17", "2026-09-17"), 0);
  assert.deepEqual(["2026-10-02", "2026-09-30", "2026-10-01"].sort(compareIso), ["2026-09-30", "2026-10-01", "2026-10-02"]);
});
