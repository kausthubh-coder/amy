import React, { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { targetsFromCalories } from "../domain/nutrition";
import { useAppData } from "../store/AppDataContext";
import { colors } from "../theme";
import { InteractivePressable } from "../components/InteractivePressable";

export function OnboardingScreen() {
  const { data, completeOnboarding } = useAppData();
  const [calories, setCalories] = useState(String(data?.goal.dailyCalories ?? 2632));
  const [currentWeight, setCurrentWeight] = useState(String(data?.goal.currentWeightLbs ?? 218));
  const [goalWeight, setGoalWeight] = useState(String(data?.goal.weightGoalLbs ?? 154));

  const numericCalories = Number(calories) || 2632;
  const macros = targetsFromCalories(numericCalories);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <View style={styles.logoRow}>
        <Image source={require("../../assets/icon-cat-alt.png")} style={styles.logo} />
      </View>
      <Text style={styles.title}>Set your target</Text>
      <Text style={styles.copy}>Choose the daily calories and weight goal Amy should use.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Daily calorie target</Text>
        <TextInput keyboardType="number-pad" value={calories} onChangeText={setCalories} style={styles.bigInput} />
        <View style={styles.macroLine}>
          <Text style={[styles.macro, { color: colors.pink }]}>C {macros.carbsTarget}g</Text>
          <Text style={[styles.macro, { color: colors.yellow }]}>P {macros.proteinTarget}g</Text>
          <Text style={[styles.macro, { color: "#E35BFF" }]}>F {macros.fatTarget}g</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.smallCard}>
          <Text style={styles.label}>Current</Text>
          <TextInput keyboardType="number-pad" value={currentWeight} onChangeText={setCurrentWeight} style={styles.smallInput} />
        </View>
        <View style={styles.smallCard}>
          <Text style={styles.label}>Goal</Text>
          <TextInput keyboardType="number-pad" value={goalWeight} onChangeText={setGoalWeight} style={styles.smallInput} />
        </View>
      </View>

      <InteractivePressable
        feedbackKind="success"
        onPress={() =>
          completeOnboarding({
            dailyCalories: numericCalories,
            currentWeightLbs: Number(currentWeight) || 0,
            weightGoalLbs: Number(goalWeight) || 0
          })
        }
        style={styles.cta}
      >
        <Text style={styles.ctaText}>Start tracking</Text>
      </InteractivePressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: 28,
    backgroundColor: colors.bg
  },
  logoRow: {
    alignItems: "center",
    marginBottom: 24
  },
  logo: {
    width: 112,
    height: 112,
    borderRadius: 28
  },
  title: {
    color: colors.ink,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "900",
    letterSpacing: 0
  },
  copy: {
    marginTop: 14,
    color: colors.muted,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700"
  },
  card: {
    marginTop: 28,
    padding: 20,
    borderRadius: 28,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  label: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "800"
  },
  bigInput: {
    marginTop: 8,
    color: colors.purple,
    fontSize: 58,
    fontWeight: "900"
  },
  macroLine: {
    flexDirection: "row",
    gap: 16
  },
  macro: {
    fontSize: 18,
    fontWeight: "900"
  },
  row: {
    flexDirection: "row",
    gap: 14,
    marginTop: 14
  },
  smallCard: {
    flex: 1,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  smallInput: {
    marginTop: 8,
    color: colors.purple,
    fontSize: 32,
    fontWeight: "900"
  },
  cta: {
    marginTop: 24,
    height: 64,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.purple
  },
  ctaText: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900"
  }
});
