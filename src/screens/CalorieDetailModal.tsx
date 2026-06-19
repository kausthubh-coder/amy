import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { MacroRing, ProgressBar } from "../components/NutritionBits";
import { totalsForDay, macroProgress, remainingCalories } from "../domain/nutrition";
import { useAppData } from "../store/AppDataContext";
import { colors } from "../theme";
import { labelForDay } from "../utils/date";

export function CalorieDetailModal() {
  const { data, selectedDay } = useAppData();
  const totals = useMemo(() => (data ? totalsForDay(data.entries, selectedDay) : { calories: 0, carbs: 0, protein: 0, fat: 0 }), [data, selectedDay]);
  if (!data) return null;

  const remain = remainingCalories(data.goal, totals);

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={styles.label}>{labelForDay(selectedDay)}</Text>
        <View style={styles.row}>
          <Text style={styles.title}>Calories</Text>
          <Text style={styles.value}>{totals.calories.toLocaleString()} / {data.goal.dailyCalories.toLocaleString()}</Text>
        </View>
        <ProgressBar value={totals.calories / data.goal.dailyCalories} />
        <Text style={styles.remaining}>{remain.toLocaleString()} calories remaining</Text>
        <View style={styles.rings}>
          <MacroRing label="Carbs" value={totals.carbs} target={data.goal.carbsTarget} color={colors.pink} />
          <MacroRing label="Protein" value={totals.protein} target={data.goal.proteinTarget} color={colors.yellow} />
          <MacroRing label="Fat" value={totals.fat} target={data.goal.fatTarget} color="#E35BFF" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Logged today</Text>
        {data.entries.filter((entry) => entry.day === selectedDay).map((entry) => (
          <View key={entry.id} style={styles.entry}>
            <View style={styles.entryInfo}>
              <Text style={styles.entryTitle}>{entry.title}</Text>
              <Text style={styles.entryMeta}>{entry.sourceLabel ?? entry.source} · {Math.round(entry.confidence * 100)}%</Text>
            </View>
            <Text style={styles.entryCalories}>{entry.macros.calories}</Text>
          </View>
        ))}
        {!data.entries.some((entry) => entry.day === selectedDay) ? <Text style={styles.empty}>Nothing logged yet.</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 20,
    gap: 14
  },
  label: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "900"
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16
  },
  title: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "900"
  },
  value: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "900"
  },
  remaining: {
    color: colors.green,
    fontSize: 16,
    fontWeight: "900"
  },
  rings: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 8
  },
  entry: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 12
  },
  entryInfo: {
    flex: 1
  },
  entryTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22
  },
  entryMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  entryCalories: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900"
  },
  empty: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: "700"
  }
});
