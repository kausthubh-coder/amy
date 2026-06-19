import React, { useEffect, useState } from "react";
import { Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { integrationConfig } from "../config/integrations";
import { targetsFromCalories } from "../domain/nutrition";
import { useAppData } from "../store/AppDataContext";
import { colors } from "../theme";
import { InteractivePressable } from "../components/InteractivePressable";

export function OnboardingScreen() {
  const { data, completeOnboarding, updateSettings } = useAppData();
  const [calories, setCalories] = useState(String(data?.goal.dailyCalories ?? 2632));
  const [currentWeight, setCurrentWeight] = useState(String(data?.goal.currentWeightLbs ?? 218));
  const [goalWeight, setGoalWeight] = useState(String(data?.goal.weightGoalLbs ?? 154));
  const [openRouterKey, setOpenRouterKey] = useState(data?.settings.openRouterKey ?? "");
  const [openRouterModel, setOpenRouterModel] = useState(data?.settings.openRouterModel ?? integrationConfig.openRouter.defaultModel);
  const [step, setStep] = useState<"targets" | "ai">("targets");
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const numericCalories = Number(calories) || 2632;
  const macros = targetsFromCalories(numericCalories);
  const startTracking = () => {
    updateSettings({
      openRouterKey: openRouterKey.trim(),
      openRouterModel: openRouterModel.trim() || integrationConfig.openRouter.defaultModel
    });
    completeOnboarding({
      dailyCalories: numericCalories,
      currentWeightLbs: Number(currentWeight) || 0,
      weightGoalLbs: Number(goalWeight) || 0
    });
  };

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.screen}>
      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, keyboardOpen && styles.contentKeyboard]}
      >
        <View style={[styles.logoRow, keyboardOpen && styles.logoRowKeyboard]}>
          <Image source={require("../../assets/icon-cat-alt.png")} style={[styles.logo, keyboardOpen && styles.logoKeyboard]} />
        </View>
        <Text style={[styles.title, keyboardOpen && styles.titleKeyboard]}>{step === "targets" ? "Set your target" : "Connect OpenRouter"}</Text>
        <Text style={[styles.copy, keyboardOpen && styles.copyKeyboard]}>
          {step === "targets"
            ? "Choose the daily calories and weight goal Amy should use."
            : "Add an optional key for better AI estimates from text, labels, and meal photos."}
        </Text>

        {step === "targets" ? (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Daily calorie target</Text>
              <TextInput keyboardType="number-pad" returnKeyType="done" value={calories} onChangeText={setCalories} style={styles.bigInput} />
              <View style={styles.macroLine}>
                <Text style={[styles.macro, { color: colors.pink }]}>C {macros.carbsTarget}g</Text>
                <Text style={[styles.macro, { color: colors.yellow }]}>P {macros.proteinTarget}g</Text>
                <Text style={[styles.macro, { color: "#E35BFF" }]}>F {macros.fatTarget}g</Text>
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.smallCard}>
                <Text style={styles.label}>Current weight</Text>
                <TextInput keyboardType="number-pad" returnKeyType="done" value={currentWeight} onChangeText={setCurrentWeight} style={styles.smallInput} />
              </View>
              <View style={styles.smallCard}>
                <Text style={styles.label}>Goal weight</Text>
                <TextInput keyboardType="number-pad" returnKeyType="done" value={goalWeight} onChangeText={setGoalWeight} style={styles.smallInput} />
              </View>
            </View>

            <InteractivePressable feedbackKind="success" onPress={() => setStep("ai")} style={styles.cta}>
              <Text style={styles.ctaText}>Continue</Text>
            </InteractivePressable>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>OpenRouter API key</Text>
            <TextInput
              value={openRouterKey}
              onChangeText={setOpenRouterKey}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="sk-or-... optional"
              placeholderTextColor={colors.dim}
              returnKeyType="next"
              style={styles.textInput}
            />
            <TextInput
              value={openRouterModel}
              onChangeText={setOpenRouterModel}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={integrationConfig.openRouter.defaultModel}
              placeholderTextColor={colors.dim}
              returnKeyType="done"
              style={styles.textInput}
            />
            <Text style={styles.hint}>Stored only on this device. Exports and repository files do not include your key.</Text>
            <View style={styles.ctaRow}>
              <InteractivePressable onPress={() => setStep("targets")} style={[styles.ctaSmall, styles.backButton]}>
                <Text style={styles.backText}>Back</Text>
              </InteractivePressable>
              <InteractivePressable feedbackKind="success" onPress={startTracking} style={[styles.ctaSmall, styles.startButton]}>
                <Text style={styles.ctaText}>Start</Text>
              </InteractivePressable>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 28,
    paddingVertical: 34
  },
  contentKeyboard: {
    justifyContent: "flex-start",
    paddingTop: 24,
    paddingBottom: 180
  },
  logoRow: {
    alignItems: "center",
    marginBottom: 24
  },
  logoRowKeyboard: {
    marginBottom: 14
  },
  logo: {
    width: 112,
    height: 112,
    borderRadius: 28
  },
  logoKeyboard: {
    width: 72,
    height: 72,
    borderRadius: 20
  },
  title: {
    color: colors.ink,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "900",
    letterSpacing: 0
  },
  titleKeyboard: {
    fontSize: 34,
    lineHeight: 38
  },
  copy: {
    marginTop: 14,
    color: colors.muted,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700"
  },
  copyKeyboard: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22
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
  textInput: {
    minHeight: 54,
    marginTop: 10,
    borderRadius: 17,
    backgroundColor: colors.panel2,
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    paddingHorizontal: 14
  },
  hint: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800"
  },
  cta: {
    marginTop: 24,
    height: 64,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.purple
  },
  ctaRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "stretch"
  },
  ctaSmall: {
    flex: 1,
    minWidth: 0,
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  backButton: {
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  startButton: {
    backgroundColor: colors.purple
  },
  backText: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  ctaText: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900"
  }
});
