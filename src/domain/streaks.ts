import { FoodEntry } from "./types";
import { addDays } from "../utils/date";

export function loggedDaySet(entries: FoodEntry[]): Set<string> {
  return new Set(entries.map((entry) => entry.day));
}

export function totalLoggedDays(entries: FoodEntry[]): number {
  return loggedDaySet(entries).size;
}

export function currentStreakDays(entries: FoodEntry[], anchorDay: string): number {
  const days = loggedDaySet(entries);
  let cursor = days.has(anchorDay) ? anchorDay : addDays(anchorDay, -1);
  let count = 0;

  while (days.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }

  return count;
}
