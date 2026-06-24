import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";

import { InteractivePressable } from "../components/InteractivePressable";
import { totalsForDay } from "../domain/nutrition";
import { WeightLog } from "../domain/types";
import { useAppData } from "../store/AppDataContext";
import { colors } from "../theme";
import { addDays, dateFromKey, weekRangeLabel } from "../utils/date";

const TREND_WIDTH = 280;
const TREND_HEIGHT = 132;

function Bar({ value, target, color }: { value: number; target: number; color: string }) {
  const height = Math.max(8, Math.min(128, target ? (value / target) * 128 : 0));
  return <View style={[styles.bar, { height, backgroundColor: color }]} />;
}

function formatWeight(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function trendSummary(logs: WeightLog[], goal: number) {
  const sorted = logs
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day) || a.createdAt.localeCompare(b.createdAt))
    .slice(-14);
  const weights = sorted.map((log) => log.weightLbs);

  if (!sorted.length) {
    return {
      logs: sorted,
      points: "",
      goalY: TREND_HEIGHT / 2,
      min: goal - 5,
      max: goal + 5,
      delta: 0,
      current: undefined as WeightLog | undefined,
      start: undefined as WeightLog | undefined
    };
  }

  const rawMin = Math.min(...weights, goal);
  const rawMax = Math.max(...weights, goal);
  const min = Math.floor(rawMin - 2);
  const max = Math.ceil(rawMax + 2);
  const range = Math.max(1, max - min);
  const positioned = sorted.map((log, index) => {
    const x = sorted.length === 1 ? TREND_WIDTH / 2 : (index / (sorted.length - 1)) * TREND_WIDTH;
    const y = TREND_HEIGHT - ((log.weightLbs - min) / range) * TREND_HEIGHT;
    return { log, x, y };
  });
  const start = sorted[0];
  const current = sorted[sorted.length - 1];

  return {
    logs: sorted,
    points: positioned.map((point) => `${point.x},${point.y}`).join(" "),
    positioned,
    goalY: TREND_HEIGHT - ((goal - min) / range) * TREND_HEIGHT,
    min,
    max,
    delta: current && start ? current.weightLbs - start.weightLbs : 0,
    current,
    start
  };
}

export function StatsModal() {
  const { data, selectedDay } = useAppData();
  const [tab, setTab] = useState<"stats" | "streaks">("stats");
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(selectedDay, index - dateFromKey(selectedDay).getDay())), [selectedDay]);
  if (!data) return null;

  const activeDays = new Set(data.entries.map((entry) => entry.day));
  const weightTrend = trendSummary(data.weightLogs, data.goal.weightGoalLbs);
  const weightDeltaLabel =
    weightTrend.delta === 0 ? "No change" : `${weightTrend.delta > 0 ? "+" : ""}${formatWeight(weightTrend.delta)} lbs`;

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
	              <Text style={styles.chartAvg}>Goal {formatWeight(data.goal.weightGoalLbs)} lbs</Text>
	            </View>
            {weightTrend.current ? (
              <>
                <View style={styles.weightStats}>
                  <View>
                    <Text style={styles.weightNow}>{formatWeight(weightTrend.current.weightLbs)} lbs</Text>
                    <Text style={styles.weightCaption}>Current</Text>
                  </View>
                  <View style={styles.weightDelta}>
                    <Text style={[styles.weightDeltaText, weightTrend.delta <= 0 ? styles.weightDeltaDown : styles.weightDeltaUp]}>
                      {weightDeltaLabel}
                    </Text>
                    <Text style={styles.weightCaption}>Last {weightTrend.logs.length}</Text>
                  </View>
                </View>
                <View style={styles.trendFrame}>
                  <Svg width="100%" height={TREND_HEIGHT} viewBox={`0 0 ${TREND_WIDTH} ${TREND_HEIGHT}`}>
                    <Line x1="0" y1={weightTrend.goalY} x2={TREND_WIDTH} y2={weightTrend.goalY} stroke={colors.green} strokeWidth="2" strokeDasharray="7 7" />
                    {weightTrend.points ? (
                      <Polyline points={weightTrend.points} fill="none" stroke={colors.pink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                    ) : null}
                    {weightTrend.positioned?.map((point) => (
                      <Circle key={point.log.id} cx={point.x} cy={point.y} r="5.5" fill={colors.ink} stroke={colors.pink} strokeWidth="3" />
                    ))}
                  </Svg>
                  <View style={styles.trendLabels}>
                    <Text style={styles.dayLabel}>
                      {weightTrend.start ? dateFromKey(weightTrend.start.day).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }) : ""}
                    </Text>
                    <Text style={styles.dayLabel}>
                      {weightTrend.current ? dateFromKey(weightTrend.current.day).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }) : ""}
                    </Text>
                  </View>
                </View>
                <View style={styles.weightRange}>
                  <Text style={styles.dayLabel}>{formatWeight(weightTrend.max)} lbs</Text>
                  <Text style={styles.dayLabel}>{formatWeight(weightTrend.min)} lbs</Text>
                </View>
              </>
            ) : (
              <Text style={styles.empty}>Log weight in Settings to start a trend.</Text>
            )}
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
  weightStats: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14
  },
  weightNow: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "900"
  },
  weightCaption: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900"
  },
  weightDelta: {
    minWidth: 104,
    minHeight: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  weightDeltaText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  weightDeltaDown: {
    color: colors.green
  },
  weightDeltaUp: {
    color: colors.pink
  },
  trendFrame: {
    minHeight: 166,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  trendLabels: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  weightRange: {
    flexDirection: "row",
    justifyContent: "space-between"
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
