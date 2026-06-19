import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useMemo, useState } from "react";
import { Platform, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { InteractivePressable } from "../components/InteractivePressable";
import { privacyBoundary } from "../config/integrations";
import { targetsFromCalories } from "../domain/nutrition";
import { getLocationContext } from "../services/location";
import { useAppData } from "../store/AppDataContext";
import { colors } from "../theme";

function Row({
  icon,
  title,
  subtitle,
  children
}: {
  icon: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function SettingsModal() {
  const { data, updateGoal, updateSettings, exportText, importText } = useAppData();
  const [calories, setCalories] = useState(String(data?.goal.dailyCalories ?? 2632));
  const [currentWeight, setCurrentWeight] = useState(String(data?.goal.currentWeightLbs ?? 218));
  const [goalWeight, setGoalWeight] = useState(String(data?.goal.weightGoalLbs ?? 154));
  const [importValue, setImportValue] = useState("");
  const [notice, setNotice] = useState("");

  const macroTargets = useMemo(() => targetsFromCalories(Number(calories) || data?.goal.dailyCalories || 2632), [calories, data?.goal.dailyCalories]);

  if (!data) return null;

  const saveGoals = () => {
    updateGoal({
      dailyCalories: Number(calories) || data.goal.dailyCalories,
      currentWeightLbs: Number(currentWeight) || data.goal.currentWeightLbs,
      weightGoalLbs: Number(goalWeight) || data.goal.weightGoalLbs
    });
    setNotice("Goals saved.");
  };

  const shareExport = async () => {
    const text = exportText();
    if (Platform.OS === "web") {
      await Clipboard.setStringAsync(text);
      setNotice("Export copied to clipboard.");
      return;
    }

    const file = new File(Paths.document, `amy-export-${Date.now()}.json`);
    file.write(text);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "Export Amy data" });
      setNotice("Export ready.");
    } else {
      await Clipboard.setStringAsync(text);
      setNotice("Export copied to clipboard.");
    }
  };

  const applyImport = () => {
    try {
      importText(importValue);
      setImportValue("");
      setNotice("Import complete.");
    } catch {
      setNotice("Import failed. Paste a full Amy JSON export.");
    }
  };

  const toggleLocation = async (enabled: boolean) => {
    if (!enabled) {
      updateSettings({ locationForRestaurants: false });
      setNotice("Restaurant location context off.");
      return;
    }

    const context = await getLocationContext();
    updateSettings({ locationForRestaurants: Boolean(context.label) });
    setNotice(context.label ? `Location context on: ${context.label}` : context.error ?? "Location unavailable.");
  };

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={styles.section}>Goals & Targets</Text>
        <View style={styles.goalHeader}>
          <Text style={styles.weight}>{data.goal.currentWeightLbs} lbs</Text>
          <Text style={styles.goalLine}>🔥 {data.goal.dailyCalories.toLocaleString()} cal · P {data.goal.proteinTarget}g · C {data.goal.carbsTarget}g · F {data.goal.fatTarget}g</Text>
        </View>
        <TextInput value={calories} onChangeText={setCalories} keyboardType="number-pad" placeholder="Calories" placeholderTextColor={colors.dim} style={styles.input} />
        <View style={styles.twoCol}>
          <TextInput value={currentWeight} onChangeText={setCurrentWeight} keyboardType="number-pad" placeholder="Current lbs" placeholderTextColor={colors.dim} style={styles.input} />
          <TextInput value={goalWeight} onChangeText={setGoalWeight} keyboardType="number-pad" placeholder="Goal lbs" placeholderTextColor={colors.dim} style={styles.input} />
        </View>
        <Text style={styles.goalLine}>Targets if saved: C {macroTargets.carbsTarget} · P {macroTargets.proteinTarget} · F {macroTargets.fatTarget}</Text>
        <InteractivePressable feedbackKind="success" onPress={saveGoals} style={styles.primaryButton}>
          <Text style={styles.primaryText}>Save goals</Text>
        </InteractivePressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Preferences</Text>
        <Row icon="↕" title="Calorie estimate bias" subtitle={data.settings.calorieBias.replaceAll("_", " ")}>
          <View style={styles.segment}>
            {(["under", "balanced", "over"] as const).map((bias) => (
              <InteractivePressable key={bias} onPress={() => updateSettings({ calorieBias: bias })} style={[styles.segmentItem, data.settings.calorieBias === bias && styles.segmentOn]}>
                <Text style={[styles.segmentText, data.settings.calorieBias === bias && styles.segmentTextOn]}>{bias}</Text>
              </InteractivePressable>
            ))}
          </View>
        </Row>
        <Row icon="⌖" title="Use location for restaurants" subtitle="Nearby context for estimates">
          <Switch value={data.settings.locationForRestaurants} onValueChange={toggleLocation} trackColor={{ true: colors.green, false: colors.panel3 }} thumbColor={colors.ink} />
        </Row>
        <Row icon="🔔" title="Daily tracking reminders">
          <Switch value={data.settings.reminders} onValueChange={(reminders) => updateSettings({ reminders })} trackColor={{ true: colors.green, false: colors.panel3 }} thumbColor={colors.ink} />
        </Row>
        <Row icon="◐" title="Appearance" subtitle={data.settings.appearance}>
          <InteractivePressable
            onPress={() => updateSettings({ appearance: data.settings.appearance === "dark" ? "light" : data.settings.appearance === "light" ? "system" : "dark" })}
            style={styles.smallButton}
          >
            <Text style={styles.smallButtonText}>Change</Text>
          </InteractivePressable>
        </Row>
        <Row icon="🎙" title="Dictation language" subtitle={data.settings.dictationLanguage === "auto" ? "Auto-detect" : data.settings.dictationLanguage} />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Local Data</Text>
        <Text style={styles.privacy}>{privacyBoundary.localData}</Text>
        <Text style={styles.privacy}>{privacyBoundary.allowedCloud}</Text>
        <InteractivePressable onPress={shareExport} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Export data</Text>
        </InteractivePressable>
        <TextInput
          value={importValue}
          onChangeText={setImportValue}
          multiline
          placeholder="Paste Amy JSON export"
          placeholderTextColor={colors.dim}
          style={[styles.input, styles.importBox]}
        />
        <InteractivePressable onPress={applyImport} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Import data</Text>
        </InteractivePressable>
      </View>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16
  },
  card: {
    gap: 13,
    padding: 18,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel
  },
  section: {
    color: colors.muted,
    fontSize: 20,
    fontWeight: "900"
  },
  goalHeader: {
    gap: 5
  },
  weight: {
    color: colors.ink,
    fontSize: 31,
    fontWeight: "900"
  },
  goalLine: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  input: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: colors.panel2,
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    paddingHorizontal: 14
  },
  twoCol: {
    flexDirection: "row",
    gap: 10
  },
  primaryButton: {
    height: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.purple
  },
  primaryText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  row: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 12
  },
  icon: {
    width: 34,
    color: colors.orange,
    fontSize: 24,
    fontWeight: "900"
  },
  rowText: {
    flex: 1
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  rowSub: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.panel2,
    borderRadius: 999,
    padding: 3
  },
  segmentItem: {
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderRadius: 999
  },
  segmentOn: {
    backgroundColor: colors.purple
  },
  segmentText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  segmentTextOn: {
    color: colors.ink
  },
  smallButton: {
    height: 42,
    borderRadius: 999,
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: colors.panel2
  },
  smallButtonText: {
    color: colors.ink,
    fontWeight: "900"
  },
  privacy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700"
  },
  secondaryButton: {
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel2
  },
  secondaryText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  importBox: {
    minHeight: 112,
    textAlignVertical: "top",
    paddingTop: 12
  },
  notice: {
    color: colors.green,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center"
  }
});
