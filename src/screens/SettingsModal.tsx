import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import { StorageAccessFramework } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import React, { useMemo, useState } from "react";
import { Platform, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { InteractivePressable } from "../components/InteractivePressable";
import { integrationConfig, privacyBoundary } from "../config/integrations";
import { targetsFromCalories } from "../domain/nutrition";
import { getLocationContext } from "../services/location";
import { useAppData } from "../store/AppDataContext";
import { colors } from "../theme";
import { labelForDay } from "../utils/date";

const EXPORT_MIME_TYPE = "application/json";
const ANDROID_DOWNLOAD_FOLDER = "Download";

function exportFileName() {
  return `amy-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
}

async function writeAndroidExport(directoryUri: string, fileName: string, text: string) {
  const fileUri = await StorageAccessFramework.createFileAsync(directoryUri, fileName, EXPORT_MIME_TYPE);
  await StorageAccessFramework.writeAsStringAsync(fileUri, text, { encoding: "utf8" });
}

async function pickAndroidExportDirectory() {
  return StorageAccessFramework.requestDirectoryPermissionsAsync(StorageAccessFramework.getUriForDirectoryInRoot(ANDROID_DOWNLOAD_FOLDER));
}

async function saveAndroidDownload(fileName: string, text: string, rememberedDirectoryUri?: string) {
  if (rememberedDirectoryUri) {
    try {
      await writeAndroidExport(rememberedDirectoryUri, fileName, text);
      return { saved: true, directoryUri: rememberedDirectoryUri };
    } catch {
      // The user may have revoked folder access; ask again below.
    }
  }

  const permission = await pickAndroidExportDirectory();
  if (!permission.granted) return { saved: false };

  await writeAndroidExport(permission.directoryUri, fileName, text);
  return { saved: true, directoryUri: permission.directoryUri };
}

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
  const { data, selectedDay, updateGoal, updateSettings, logWeight, exportText, importText } = useAppData();
  const [calories, setCalories] = useState(String(data?.goal.dailyCalories ?? 2632));
  const [currentWeight, setCurrentWeight] = useState(String(data?.goal.currentWeightLbs ?? 218));
  const [goalWeight, setGoalWeight] = useState(String(data?.goal.weightGoalLbs ?? 154));
  const [weightNote, setWeightNote] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState(data?.settings.openRouterKey ?? "");
  const [openRouterModel, setOpenRouterModel] = useState(data?.settings.openRouterModel ?? integrationConfig.openRouter.defaultModel);
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

  const saveWeightLog = () => {
    const weight = Number(currentWeight) || data.goal.currentWeightLbs;
    logWeight(selectedDay, weight, weightNote);
    setWeightNote("");
    setNotice(`Weight logged for ${labelForDay(selectedDay)}.`);
  };

  const saveAiSettings = () => {
    updateSettings({
      openRouterKey: openRouterKey.trim(),
      openRouterModel: openRouterModel.trim() || integrationConfig.openRouter.defaultModel
    });
    setNotice(openRouterKey.trim() ? "OpenRouter key saved locally." : "OpenRouter key cleared.");
  };

  const copyExport = async () => {
    const text = exportText();
    await Clipboard.setStringAsync(text);
    setNotice("Export copied to clipboard.");
  };

  const downloadExport = async () => {
    const text = exportText();
    const fileName = exportFileName();
    if (Platform.OS === "web") {
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Export downloaded.");
      return;
    }

    if (Platform.OS === "android") {
      try {
        const result = await saveAndroidDownload(fileName, text, data.settings.androidExportDirectoryUri);
        if (!result.saved) {
          setNotice("Export download canceled.");
          return;
        }
        if (result.directoryUri !== data.settings.androidExportDirectoryUri) {
          updateSettings({ androidExportDirectoryUri: result.directoryUri });
        }
        setNotice("Export downloaded to your selected folder.");
        return;
      } catch {
        setNotice("Download failed. Opening export options instead.");
      }
    }

    const file = new File(Paths.document, fileName);
    file.write(text);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "Download Amy data" });
      setNotice("Export file ready.");
    } else {
      await Clipboard.setStringAsync(text);
      setNotice("Export copied to clipboard.");
    }
  };

  const applyImportText = (text: string) => {
    try {
      importText(text);
      setImportValue("");
      setNotice("Import complete.");
    } catch {
      setNotice("Import failed. Paste a full Amy JSON export.");
    }
  };

  const applyImport = () => applyImportText(importValue);

  const importFile = async () => {
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ["application/json", "text/plain", "*/*"] });
      if (picked.canceled) return;
      const text = await picked.result.text();
      applyImportText(text);
    } catch {
      setNotice("Import failed. Choose a full Amy JSON export file.");
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
        <Text style={styles.section}>Weight Tracking</Text>
        <View style={styles.weightSummary}>
          <View>
            <Text style={styles.weight}>{data.goal.currentWeightLbs} lbs</Text>
            <Text style={styles.goalLine}>Goal {data.goal.weightGoalLbs} lbs</Text>
          </View>
          <View style={styles.keyState}>
            <Text style={styles.keyStateText}>{data.weightLogs.length}</Text>
          </View>
        </View>
        <TextInput value={currentWeight} onChangeText={setCurrentWeight} keyboardType="number-pad" placeholder="Current lbs" placeholderTextColor={colors.dim} style={styles.input} />
        <TextInput value={weightNote} onChangeText={setWeightNote} placeholder="Note, optional" placeholderTextColor={colors.dim} style={styles.input} />
        <InteractivePressable feedbackKind="success" onPress={saveWeightLog} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Log weight</Text>
        </InteractivePressable>
        <View style={styles.weightHistory}>
          {data.weightLogs.slice(0, 5).map((log) => (
            <View key={log.id} style={styles.weightLogRow}>
              <Text style={styles.weightLogDay}>{labelForDay(log.day)}</Text>
              <Text style={styles.weightLogValue}>{log.weightLbs} lbs</Text>
            </View>
          ))}
          {!data.weightLogs.length ? <Text style={styles.privacy}>No weight logs yet.</Text> : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Preferences</Text>
        <Row icon="✦" title="OpenRouter key" subtitle={data.settings.openRouterKey ? "Saved locally on this device" : "Needed for AI estimates"}>
          <View style={styles.keyState}>
            <Text style={styles.keyStateText}>{data.settings.openRouterKey ? "Set" : "Off"}</Text>
          </View>
        </Row>
        <TextInput
          value={openRouterKey}
          onChangeText={setOpenRouterKey}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="sk-or-..."
          placeholderTextColor={colors.dim}
          style={styles.input}
        />
        <TextInput
          value={openRouterModel}
          onChangeText={setOpenRouterModel}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={integrationConfig.openRouter.defaultModel}
          placeholderTextColor={colors.dim}
          style={styles.input}
        />
        <InteractivePressable feedbackKind="edit" onPress={saveAiSettings} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Save OpenRouter</Text>
        </InteractivePressable>
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
        <View style={styles.exportActions}>
          <InteractivePressable onPress={downloadExport} style={[styles.secondaryButton, styles.exportButton]}>
            <Text style={styles.secondaryText}>Download JSON</Text>
          </InteractivePressable>
          <InteractivePressable onPress={copyExport} style={[styles.secondaryButton, styles.exportButton]}>
            <Text style={styles.secondaryText}>Copy JSON</Text>
          </InteractivePressable>
        </View>
        <InteractivePressable onPress={importFile} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Import file</Text>
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
          <Text style={styles.secondaryText}>Import pasted JSON</Text>
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
  keyState: {
    minWidth: 48,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  keyStateText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  weightSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  weightHistory: {
    gap: 8
  },
  weightLogRow: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.panel2
  },
  weightLogDay: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "900"
  },
  weightLogValue: {
    color: colors.ink,
    fontSize: 15,
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
  exportActions: {
    flexDirection: "row",
    gap: 10
  },
  exportButton: {
    flex: 1
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
