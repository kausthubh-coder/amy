import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { checkOpenRouterKey } from "../agent/client";
import { integrationConfig } from "../config/integrations";
import { targetsFromCalories } from "../domain/nutrition";
import { DEFAULT_DAILY_CALORIES } from "../domain/seed";
import { getLocationContext } from "../services/location";
import { useAppData } from "../store/AppDataContext";
import { colors } from "../theme";
import { InteractivePressable } from "../components/InteractivePressable";

function parseNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function OnboardingScreen() {
  const { data, completeOnboarding } = useAppData();
  const [calories, setCalories] = useState(String(data?.goal.dailyCalories ?? DEFAULT_DAILY_CALORIES));
  const [currentWeight, setCurrentWeight] = useState(data?.goal.currentWeightLbs ? String(data.goal.currentWeightLbs) : "");
  const [goalWeight, setGoalWeight] = useState(data?.goal.weightGoalLbs ? String(data.goal.weightGoalLbs) : "");
  const [openRouterKey, setOpenRouterKey] = useState(data?.settings.openRouterKey ?? "");
  const [openRouterModel, setOpenRouterModel] = useState(data?.settings.openRouterModel ?? integrationConfig.openRouter.defaultModel);
  const [useLocation, setUseLocation] = useState(data?.settings.locationForRestaurants ?? false);
  const [locationNote, setLocationNote] = useState("");
  const [keyCheck, setKeyCheck] = useState<{ busy: boolean; message: string; ok?: boolean }>({ busy: false, message: "" });
  const [error, setError] = useState("");
  const [step, setStep] = useState<"targets" | "ai">("targets");
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const numericCalories = Math.round(parseNumber(calories));
  const macros = targetsFromCalories(numericCalories || DEFAULT_DAILY_CALORIES);
  const hasKey = Boolean(openRouterKey.trim());

  const continueToAi = () => {
    if (numericCalories < 800 || numericCalories > 10000) {
      setError("Enter a daily calorie target between 800 and 10,000.");
      return;
    }
    setError("");
    setStep("ai");
  };

  const testKey = async () => {
    setKeyCheck({ busy: true, message: "" });
    const result = await checkOpenRouterKey(openRouterKey);
    if (!result.ok) {
      setKeyCheck({ busy: false, ok: false, message: result.message });
      return;
    }
    const credit = result.remaining !== undefined ? ` · $${result.remaining.toFixed(2)} credit left` : "";
    setKeyCheck({ busy: false, ok: true, message: `Key works${credit}` });
  };

  const toggleLocation = async (enabled: boolean) => {
    if (!enabled) {
      setUseLocation(false);
      setLocationNote("");
      return;
    }
    const context = await getLocationContext({ fresh: true });
    setUseLocation(Boolean(context.label));
    setLocationNote(context.label ? `Estimates will use: ${context.label}` : (context.error ?? "Location unavailable."));
  };

  const startTracking = () => {
    completeOnboarding(
      { dailyCalories: numericCalories || DEFAULT_DAILY_CALORIES, currentWeightLbs: parseNumber(currentWeight), weightGoalLbs: parseNumber(goalWeight) },
      {
        openRouterKey: openRouterKey.trim(),
        openRouterModel: openRouterModel.trim() || integrationConfig.openRouter.defaultModel,
        locationForRestaurants: useLocation && hasKey
      }
    );
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
        <Text accessibilityRole="header" style={[styles.title, keyboardOpen && styles.titleKeyboard]}>
          {step === "targets" ? "Set your target" : "Smart estimates"}
        </Text>
        <Text style={[styles.copy, keyboardOpen && styles.copyKeyboard]}>
          {step === "targets" ? "Step 1 of 2. Choose the daily calories Amy should track against. Weights are optional." : "Step 2 of 2. Optional, and you can set this up later in Settings."}
        </Text>

        {step === "targets" ? (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Daily calorie target</Text>
              <TextInput
                keyboardType="number-pad"
                returnKeyType="done"
                value={calories}
                onChangeText={setCalories}
                selectTextOnFocus
                accessibilityLabel="Daily calorie target"
                style={styles.bigInput}
              />
              <View style={styles.macroLine}>
                <Text style={[styles.macro, { color: colors.pink }]}>C {macros.carbsTarget}g</Text>
                <Text style={[styles.macro, { color: colors.blue }]}>P {macros.proteinTarget}g</Text>
                <Text style={[styles.macro, { color: colors.yellow }]}>F {macros.fatTarget}g</Text>
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.smallCard}>
                <Text style={styles.label}>Current lbs</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  value={currentWeight}
                  onChangeText={setCurrentWeight}
                  placeholder="optional"
                  placeholderTextColor={colors.dim}
                  accessibilityLabel="Current weight in pounds, optional"
                  style={styles.smallInput}
                />
              </View>
              <View style={styles.smallCard}>
                <Text style={styles.label}>Goal lbs</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  value={goalWeight}
                  onChangeText={setGoalWeight}
                  placeholder="optional"
                  placeholderTextColor={colors.dim}
                  accessibilityLabel="Goal weight in pounds, optional"
                  style={styles.smallInput}
                />
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <InteractivePressable accessibilityRole="button" feedbackKind="success" onPress={continueToAi} style={styles.cta}>
              <Text style={styles.ctaText}>Continue</Text>
            </InteractivePressable>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>How logging works</Text>
            <View style={styles.bullets}>
              <Text style={styles.bullet}>• Without a key: type calories yourself ("latte 190 cal"), reuse saved meals, and scan barcodes. Amy never invents numbers.</Text>
              <Text style={styles.bullet}>• With a key: Amy estimates typed lines, meal photos, and nutrition labels using an AI model you pay for directly, usually a fraction of a cent per meal.</Text>
            </View>
            <InteractivePressable accessibilityRole="link" onPress={() => void Linking.openURL(integrationConfig.openRouter.keysUrl)} style={styles.linkButton}>
              <Text style={styles.linkText}>Get a free OpenRouter key →</Text>
            </InteractivePressable>
            <TextInput
              value={openRouterKey}
              onChangeText={(value) => {
                setOpenRouterKey(value);
                setKeyCheck({ busy: false, message: "" });
              }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="sk-or-... (optional)"
              placeholderTextColor={colors.dim}
              accessibilityLabel="OpenRouter API key, optional"
              style={styles.textInput}
            />
            {hasKey ? (
              <>
                <TextInput
                  value={openRouterModel}
                  onChangeText={setOpenRouterModel}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={integrationConfig.openRouter.defaultModel}
                  placeholderTextColor={colors.dim}
                  accessibilityLabel="AI model"
                  style={styles.textInput}
                />
                <InteractivePressable accessibilityRole="button" onPress={testKey} disabled={keyCheck.busy} style={styles.testRow}>
                  {keyCheck.busy ? <ActivityIndicator color={colors.ink} /> : null}
                  <Text style={styles.testText}>{keyCheck.busy ? "Checking..." : "Test key"}</Text>
                </InteractivePressable>
                {keyCheck.message ? <Text style={[styles.hint, { color: keyCheck.ok ? colors.green : colors.pink }]}>{keyCheck.message}</Text> : null}
                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.switchTitle}>Use rough location</Text>
                    <Text style={styles.hint}>{locationNote || "Shares only your city and country with estimates, for local restaurants and regional portions."}</Text>
                  </View>
                  <Switch value={useLocation} onValueChange={toggleLocation} trackColor={{ true: colors.green, false: colors.panel3 }} thumbColor={colors.ink} />
                </View>
              </>
            ) : null}
            <Text style={styles.hint}>The key stays on this device. Exports never include it.</Text>
            <View style={styles.ctaRow}>
              <InteractivePressable accessibilityRole="button" onPress={() => setStep("targets")} style={[styles.ctaSmall, styles.backButton]}>
                <Text style={styles.backText}>Back</Text>
              </InteractivePressable>
              <InteractivePressable accessibilityRole="button" feedbackKind="success" onPress={startTracking} style={[styles.ctaSmall, styles.startButton]}>
                <Text style={styles.ctaText}>{hasKey ? "Start" : "Skip for now"}</Text>
              </InteractivePressable>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bullets: {
    marginTop: 12,
    gap: 6
  },
  bullet: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700"
  },
  linkButton: {
    minHeight: 44,
    marginTop: 6,
    justifyContent: "center"
  },
  linkText: {
    color: colors.blue,
    fontSize: 15,
    fontWeight: "900"
  },
  testRow: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  testText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  switchRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  switchCopy: {
    flex: 1,
    minWidth: 0
  },
  switchTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  error: {
    marginTop: 10,
    color: colors.pink,
    fontSize: 14,
    fontWeight: "800"
  },
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
