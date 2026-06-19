import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { MacroTotals } from "../domain/types";
import { colors } from "../theme";

export function MacroFooter({ totals }: { totals: MacroTotals }) {
  return (
    <View style={styles.footer}>
      <Text style={styles.fire}>🔥 {Math.round(totals.calories).toLocaleString()}</Text>
      <Text style={[styles.dot]}>•</Text>
      <Text style={[styles.macro, { color: colors.pink }]}>C {Math.round(totals.carbs)}</Text>
      <Text style={styles.dot}>•</Text>
      <Text style={[styles.macro, { color: colors.yellow }]}>P {Math.round(totals.protein)}</Text>
      <Text style={styles.dot}>•</Text>
      <Text style={[styles.macro, { color: "#E35BFF" }]}>F {Math.round(totals.fat)}</Text>
    </View>
  );
}

export function ProgressBar({ value, color = colors.green }: { value: number; color?: string }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function MacroRing({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const progress = target > 0 ? Math.min(1, value / target) : 0;
  return (
    <View style={styles.ringWrap}>
      <View style={[styles.ring, { borderColor: progress > 0.8 ? color : colors.line }]}>
        <Text style={styles.ringValue}>{Math.round(value)}</Text>
      </View>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    minHeight: 62,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 22
  },
  fire: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900"
  },
  macro: {
    fontSize: 22,
    fontWeight: "900"
  },
  dot: {
    color: colors.dim,
    fontSize: 22,
    fontWeight: "900"
  },
  track: {
    height: 13,
    borderRadius: 999,
    backgroundColor: colors.panel3,
    overflow: "hidden"
  },
  fill: {
    height: "100%",
    borderRadius: 999
  },
  ringWrap: {
    alignItems: "center",
    gap: 8
  },
  ring: {
    width: 76,
    height: 76,
    borderRadius: 999,
    borderWidth: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel
  },
  ringValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900"
  },
  ringLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  }
});
