import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { InteractivePressable } from "../components/InteractivePressable";
import { totalsForDay } from "../domain/nutrition";
import { useAppData } from "../store/AppDataContext";
import { colors } from "../theme";
import { addDays, dateFromKey, weekRangeLabel } from "../utils/date";

function Bar({ value, target, color }: { value: number; target: number; color: string }) {
  const height = Math.max(8, Math.min(128, target ? (value / target) * 128 : 0));
  return <View style={[styles.bar, { height, backgroundColor: color }]} />;
}

export function StatsModal() {
  const { data, selectedDay } = useAppData();
  const [tab, setTab] = useState<"stats" | "streaks">("stats");
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(selectedDay, index - dateFromKey(selectedDay).getDay())), [selectedDay]);
  if (!data) return null;

  const activeDays = new Set(data.entries.map((entry) => entry.day));
  const weightLogs = data.weightLogs.slice(0, 7).reverse();

  return (
    <View style={styles.stack}>
      <View style={styles.segment}>
        <InteractivePressable onPress={() => setTab("stats")} style={[styles.segmentButton, tab === "stats" && styles.segmentOn]}>
          <Text style={[styles.segmentText, tab === "stats" && styles.segmentTextOn]}>Stats</Text>
        </InteractivePressable>
        <InteractivePressable onPress={() => setTab("streaks")} style={[styles.segmentButton, tab === "streaks" && styles.segmentOn]}>
          <Text style={[styles.segmentText, tab === "streaks" && styles.segmentTextOn]}>Streaks 🔥 {activeDays.size}</Text>
        </InteractivePressable>
      </View>

      {tab === "stats" ? (
        <>
          <Text style={styles.week}>{weekRangeLabel(selectedDay)}</Text>
          {[
            { label: "Calories Consumed", field: "calories" as const, color: "#D82EFF", target: data.goal.dailyCalories },
            { label: "Protein", field: "protein" as const, color: colors.blue, target: data.goal.proteinTarget },
            { label: "Carbs", field: "carbs" as const, color: colors.pink, target: data.goal.carbsTarget },
            { label: "Fat", field: "fat" as const, color: "#E35BFF", target: data.goal.fatTarget }
	          ].map((metric) => (
	            <View key={metric.label} style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>{metric.label}</Text>
                <Text style={styles.chartAvg}>Goal {Math.round(metric.target)}</Text>
              </View>
              <View style={styles.chart}>
                {days.map((day) => {
                  const total = totalsForDay(data.entries, day);
                  return (
                    <View key={day} style={styles.barSlot}>
                      <Bar value={total[metric.field]} target={metric.target} color={metric.color} />
                      <Text style={styles.dayLabel}>{dateFromKey(day).toLocaleDateString(undefined, { weekday: "narrow" })}</Text>
                    </View>
                  );
                })}
              </View>
	            </View>
	          ))}
	          <View style={styles.chartCard}>
	            <View style={styles.chartHeader}>
	              <Text style={styles.chartTitle}>Weight</Text>
	              <Text style={styles.chartAvg}>Goal {data.goal.weightGoalLbs} lbs</Text>
	            </View>
	            <View style={styles.weightTrend}>
	              {weightLogs.map((log) => (
	                <View key={log.id} style={styles.weightPoint}>
	                  <Text style={styles.weightValue}>{log.weightLbs}</Text>
	                  <Text style={styles.dayLabel}>{dateFromKey(log.day).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}</Text>
	                </View>
	              ))}
	              {!weightLogs.length ? <Text style={styles.empty}>Log weight in Settings to start a trend.</Text> : null}
	            </View>
	          </View>
	        </>
      ) : (
        <>
          <View style={styles.flameCard}>
            <Text style={styles.bigFlame}>{activeDays.size}</Text>
            <Text style={styles.flameText}>{activeDays.size === 1 ? "day" : "days"} logged</Text>
          </View>
          <View style={styles.calendar}>
            {Array.from({ length: 30 }, (_, index) => index + 1).map((day) => {
              const date = new Date(dateFromKey(selectedDay));
              date.setDate(day);
              const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const on = activeDays.has(key);
              return (
                <View key={day} style={[styles.calendarDay, on && styles.calendarDayOn]}>
                  <Text style={[styles.calendarText, on && styles.calendarTextOn]}>{day}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.repairRow}>
            <Text style={styles.repairText}>🚧 3 repairs available</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16
  },
  segment: {
    alignSelf: "center",
    flexDirection: "row",
    padding: 5,
    borderRadius: 999,
    backgroundColor: colors.panel2
  },
  segmentButton: {
    minWidth: 128,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999
  },
  segmentOn: {
    backgroundColor: colors.panel
  },
  segmentText: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: "900"
  },
  segmentTextOn: {
    color: colors.ink
  },
  week: {
    color: colors.ink,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "900"
  },
  chartCard: {
    borderRadius: 28,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    gap: 12
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  chartTitle: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "900"
  },
  chartAvg: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "900"
  },
  chart: {
    height: 170,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around"
  },
  barSlot: {
    alignItems: "center",
    gap: 9
  },
  bar: {
    width: 34,
    borderRadius: 10
  },
  dayLabel: {
    color: colors.muted,
    fontWeight: "900"
  },
  weightTrend: {
    minHeight: 92,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: 10
  },
  weightPoint: {
    minWidth: 54,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.panel2
  },
  weightValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  empty: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: "800"
  },
  flameCard: {
    alignItems: "center",
    borderRadius: 28,
    backgroundColor: colors.panel,
    padding: 28
  },
  bigFlame: {
    color: colors.orange,
    fontSize: 86,
    fontWeight: "900"
  },
  flameText: {
    color: colors.muted,
    fontSize: 23,
    fontWeight: "900"
  },
  calendar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: colors.panel,
    padding: 20
  },
  calendarDay: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.line
  },
  calendarDayOn: {
    backgroundColor: colors.green,
    borderColor: colors.blue
  },
  calendarText: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  calendarTextOn: {
    color: colors.bg
  },
  repairRow: {
    borderRadius: 22,
    backgroundColor: colors.panel,
    padding: 20
  },
  repairText: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900"
  }
});
