import { FoodEntry } from "./types";

export type LineRow<Status> = {
  key: string;
  index: number;
  text: string;
  norm: string;
  completed: boolean;
  entry?: FoodEntry;
  status?: Status;
};

export function normalizeMealLine(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function lineKey(index: number, text: string) {
  return `${index}:${normalizeMealLine(text)}`;
}

export function splitLogLines(text: string) {
  return text.replace(/\r\n/g, "\n").split("\n");
}

export function entryLineNorm(entry: FoodEntry) {
  return normalizeMealLine(entry.rawInput ?? entry.title);
}

// A line is worth estimating once it has at least two characters and a letter ("egg", "tea", "pho").
export function isLoggableLine(text: string) {
  const trimmed = text.trim();
  return trimmed.length >= 2 && /[A-Za-zÀ-￿]/.test(trimmed);
}

/**
 * Pairs note lines with logged entries. Entries match lines by normalized text, oldest entry first,
 * so duplicate lines ("coffee" twice) each get their own entry. The last line only counts as
 * completed when `commitLast` is set (blur, dictation finished, app backgrounded).
 */
export function buildLineRows<Status>(
  text: string,
  entries: FoodEntry[],
  statuses: Record<string, Status>,
  commitLast = false
): LineRow<Status>[] {
  const buckets = new Map<string, FoodEntry[]>();
  entries
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((entry) => {
      const key = entryLineNorm(entry);
      if (!key) return;
      const list = buckets.get(key) ?? [];
      list.push(entry);
      buckets.set(key, list);
    });

  const used = new Map<string, number>();
  const lines = splitLogLines(text);
  return lines.map((line, index) => {
    const norm = normalizeMealLine(line);
    const key = lineKey(index, line);
    let entry: FoodEntry | undefined;
    if (norm) {
      const bucket = buckets.get(norm) ?? [];
      const usedCount = used.get(norm) ?? 0;
      entry = bucket[usedCount];
      used.set(norm, usedCount + 1);
    }
    return { key, index, text: line, norm, completed: commitLast || index < lines.length - 1, entry, status: statuses[key] };
  });
}

export function countLineNorms(text: string) {
  const counts = new Map<string, number>();
  splitLogLines(text).forEach((line) => {
    const norm = normalizeMealLine(line);
    if (!norm) return;
    counts.set(norm, (counts.get(norm) ?? 0) + 1);
  });
  return counts;
}

/** Entries whose note line no longer exists in `nextText`. Newest duplicates go first. */
export function entriesWithoutLines(nextText: string, entries: FoodEntry[]): FoodEntry[] {
  const counts = countLineNorms(nextText);
  const seen = new Map<string, number>();
  const orphaned: FoodEntry[] = [];
  entries
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((entry) => {
      const norm = entryLineNorm(entry);
      if (!norm) return;
      const index = seen.get(norm) ?? 0;
      seen.set(norm, index + 1);
      if (index >= (counts.get(norm) ?? 0)) orphaned.push(entry);
    });
  return orphaned;
}

/**
 * Detects an in-place edit of exactly one line (same line count, one line changed to a non-empty
 * value). Those edits keep the logged entry attached instead of deleting it.
 */
export function singleLineEdit(previousText: string, nextText: string): { index: number; before: string; after: string } | null {
  const before = splitLogLines(previousText);
  const after = splitLogLines(nextText);
  if (before.length !== after.length) return null;
  let changed = -1;
  for (let index = 0; index < before.length; index += 1) {
    if (before[index] === after[index]) continue;
    if (changed !== -1) return null;
    changed = index;
  }
  if (changed === -1) return null;
  const beforeLine = before[changed] ?? "";
  const afterLine = after[changed] ?? "";
  if (!normalizeMealLine(beforeLine) || !normalizeMealLine(afterLine)) return null;
  return { index: changed, before: beforeLine, after: afterLine };
}

/** "protein shake 160 cal" -> { title: "protein shake", calories: 160 }. Needs an explicit unit. */
export function parseInlineCalories(line: string): { title: string; calories: number } | null {
  const match = line.trim().match(/^(.*?[A-Za-zÀ-￿].*?)[\s,:\-–—=]+(\d{1,4}(?:[.,]\d+)?)\s*(?:k?cals?|calories)\.?$/i);
  if (!match) return null;
  const title = (match[1] ?? "").trim();
  const calories = Math.round(Number((match[2] ?? "").replace(",", ".")));
  if (!title || !Number.isFinite(calories) || calories < 0 || calories > 9999) return null;
  return { title, calories };
}

/** External text (deep links, widgets) must never auto-complete a line: collapse it to one line. */
export function sanitizePrefill(text: string | undefined | null) {
  return (text ?? "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}
