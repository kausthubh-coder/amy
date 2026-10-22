import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { colors } from "../theme";

const RING_SIZE = 76;
const RING_STROKE = 9;
const RING_CENTER = RING_SIZE / 2;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function ProgressBar({ value, color = colors.green }: { value: number; color?: string }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function MacroRing({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const progress = target > 0 ? Math.min(1, value / target) : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);
  return (
    <View accessible accessibilityLabel={`${label}: ${Math.round(value)} of ${Math.round(target)} grams`} style={styles.ringWrap}>
      <View style={styles.ring}>
        <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} style={styles.ringSvg}>
          <Circle cx={RING_CENTER} cy={RING_CENTER} r={RING_RADIUS} stroke={colors.track} strokeWidth={RING_STROKE} fill="none" />
          <Circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_RADIUS}
            stroke={color}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
          />
        </Svg>
        <Text style={styles.ringValue}>{Math.round(value)}</Text>
      </View>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 13,
    borderRadius: 999,
    backgroundColor: colors.track,
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
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel
  },
  ringSvg: {
    position: "absolute",
    left: 0,
    top: 0
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
