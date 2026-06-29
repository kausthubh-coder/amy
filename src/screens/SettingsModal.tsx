import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import { StorageAccessFramework } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Copy, Download, FileText, Save, ShieldCheck, Upload } from "lucide-react-native";
import React, { useState } from "react";
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

function formatNumber(value: number) {
  return Math.round(value).toLocaleString();
}

function formatWeight(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function numberFromInput(value: string, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function macroGrams(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function goalStatus(currentWeight: number, goalWeight: number) {
  const delta = currentWeight - goalWeight;
  if (Math.abs(delta) < 0.5) {
    return { type: "Maintain", status: "At target weight" };
  }

  if (delta > 0) {
    return { type: "Weight loss", status: `${formatWeight(delta)} lb to lose` };
  }

  return { type: "Weight gain", status: `${formatWeight(Math.abs(delta))} lb to gain` };
}

function IconAction({
  icon,
  label,
  onPress,
  variant = "secondary",
  grow = true,
  disabled
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  grow?: boolean;
  disabled?: boolean;
}) {
  return (
    <InteractivePressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, grow && styles.actionButtonGrow, variant === "primary" && styles.actionButtonPrimary]}
    >
      {icon}
      <Text style={[styles.actionButtonText, variant === "primary" && styles.actionButtonTextPrimary]}>{label}</Text>
    </InteractivePressable>
  );
}

function DataCount({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.dataCount}>
      <Text style={styles.dataCountValue}>{formatNumber(value)}</Text>
      <Text style={styles.dataCountLabel}>{label}</Text>
    </View>
  );
}

export function SettingsModal() {
  const { data, selectedDay, updateGoal, updateSettings, logWeight, exportText, importText } = useAppData();
  const [calories, setCalories] = useState(String(data?.goal.dailyCalories ?? 2632));
  const [carbs, setCarbs] = useState(String(data?.goal.carbsTarget ?? 0));
  const [protein, setProtein] = useState(String(data?.goal.proteinTarget ?? 0));
  const [fat, setFat] = useState(String(data?.goal.fatTarget ?? 0));
  const [currentWeight, setCurrentWeight] = useState(String(data?.goal.currentWeightLbs ?? 218));
  const [goalWeight, setGoalWeight] = useState(String(data?.goal.weightGoalLbs ?? 154));
  const [weightNote, setWeightNote] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState(data?.settings.openRouterKey ?? "");
  const [openRouterModel, setOpenRouterModel] = useState(data?.settings.openRouterModel ?? integrationConfig.openRouter.defaultModel);
  const [importValue, setImportValue] = useState("");
  const [showPasteImport, setShowPasteImport] = useState(false);
  const [notice, setNotice] = useState("");

  const pendingCalories = numberFromInput(calories, data?.goal.dailyCalories ?? 2632);

  if (!data) return null;

  const pendingCurrentWeight = numberFromInput(currentWeight, data.goal.currentWeightLbs);
  const pendingGoalWeight = numberFromInput(goalWeight, data.goal.weightGoalLbs);
  const pendingStatus = goalStatus(pendingCurrentWeight, pendingGoalWeight);
  const macroFields = [
    { key: "carbs", label: "Carbs", color: colors.pink, value: carbs, onChange: setCarbs },
    { key: "protein", label: "Protein", color: colors.blue, value: protein, onChange: setProtein },
    { key: "fat", label: "Fat", color: colors.yellow, value: fat, onChange: setFat }
  ];
  const macroCalories = Math.round(macroGrams(carbs) * 4 + macroGrams(protein) * 4 + macroGrams(fat) * 9);
  const hasImportValue = importValue.trim().length > 0;

  const autoBalanceMacros = () => {
    const balanced = targetsFromCalories(pendingCalories);
    setCarbs(String(balanced.carbsTarget));
    setProtein(String(balanced.proteinTarget));
    setFat(String(balanced.fatTarget));
    setNotice("Macros balanced from calories. Tap Save goals to keep them.");
  };

  const saveGoals = () => {
    updateGoal({
      dailyCalories: pendingCalories,
      carbsTarget: Math.round(macroGrams(carbs)),
      proteinTarget: Math.round(macroGrams(protein)),
      fatTarget: Math.round(macroGrams(fat))
    });
    setNotice("Goals saved.");
  };

  const saveWeightLog = () => {
    const weight = numberFromInput(currentWeight, data.goal.currentWeightLbs);
    logWeight(selectedDay, weight, weightNote);
    updateGoal({ currentWeightLbs: weight, weightGoalLbs: pendingGoalWeight });
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

  const applyImport = () => {
    if (!hasImportValue) {
      setNotice("Paste a full Amy JSON export first.");
      return;
    }
    applyImportText(importValue.trim());
  };

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

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Daily calories</Text>
          <TextInput value={calories} onChangeText={setCalories} keyboardType="number-pad" placeholder="Calories" placeholderTextColor={colors.muted} style={styles.input} />
        </View>

        <View style={styles.macroHeaderRow}>
          <Text style={styles.fieldLabel}>Macro targets (grams)</Text>
          <InteractivePressable accessibilityRole="button" accessibilityLabel="Auto-balance macros from calories" onPress={autoBalanceMacros} style={styles.autoButton}>
            <Text style={styles.autoButtonText}>Auto-balance</Text>
          </InteractivePressable>
        </View>
        <View style={styles.macroInputRow}>
          {macroFields.map((macro) => (
            <View key={macro.key} style={styles.macroInputField}>
              <View style={styles.macroInputLabelRow}>
                <View style={[styles.macroDot, { backgroundColor: macro.color }]} />
                <Text style={styles.macroInputLabel}>{macro.label}</Text>
              </View>
              <TextInput
                value={macro.value}
                onChangeText={macro.onChange}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={styles.macroTargetInput}
              />
            </View>
          ))}
        </View>
        <Text style={styles.macroCalHint}>≈ {formatNumber(macroCalories)} cal from macros · target {formatNumber(pendingCalories)} cal</Text>

        <InteractivePressable feedbackKind="success" onPress={saveGoals} style={styles.primaryButton}>
          <Save size={18} color={colors.ink} strokeWidth={3} />
          <Text style={styles.primaryText}>Save goals</Text>
        </InteractivePressable>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.section}>Weight Tracking</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{pendingStatus.type}</Text>
          </View>
        </View>
        <View style={styles.twoCol}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Current lbs</Text>
            <TextInput value={currentWeight} onChangeText={setCurrentWeight} keyboardType="number-pad" placeholder="Current lbs" placeholderTextColor={colors.muted} style={styles.input} />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Goal lbs</Text>
            <TextInput value={goalWeight} onChangeText={setGoalWeight} keyboardType="number-pad" placeholder="Goal lbs" placeholderTextColor={colors.muted} style={styles.input} />
          </View>
        </View>
        <Text style={styles.goalLine}>{pendingStatus.status}</Text>
        <TextInput value={weightNote} onChangeText={setWeightNote} placeholder="Note, optional" placeholderTextColor={colors.muted} style={styles.input} />
        <InteractivePressable feedbackKind="success" onPress={saveWeightLog} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Log weight & update goal</Text>
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
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <TextInput
          value={openRouterModel}
          onChangeText={setOpenRouterModel}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={integrationConfig.openRouter.defaultModel}
          placeholderTextColor={colors.muted}
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
        <View style={styles.sectionHeader}>
          <Text style={styles.section}>Local Data</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>On device</Text>
          </View>
        </View>
        <View style={styles.dataCounts}>
          <DataCount label="foods" value={data.entries.length} />
          <DataCount label="saved" value={data.savedMeals.length} />
          <DataCount label="weights" value={data.weightLogs.length} />
        </View>
        <View style={styles.safetyBox}>
          <ShieldCheck size={20} color={colors.green} strokeWidth={2.6} />
          <View style={styles.safetyCopy}>
            <Text style={styles.safetyTitle}>Private backup</Text>
            <Text style={styles.privacy}>Exports include meals, notes, goals, saved meals, and weight logs. OpenRouter keys and Android folder access are left out.</Text>
          </View>
        </View>
        <Text style={styles.privacy}>{privacyBoundary.localData}</Text>
        <Text style={styles.privacy}>{privacyBoundary.allowedCloud}</Text>
        <View style={styles.dataSection}>
          <Text style={styles.dataSectionTitle}>Export backup</Text>
          <View style={styles.exportActions}>
            <IconAction icon={<Download size={18} color={colors.ink} strokeWidth={3} />} label="Download" onPress={downloadExport} variant="primary" />
            <IconAction icon={<Copy size={18} color={colors.ink} strokeWidth={3} />} label="Copy JSON" onPress={copyExport} />
          </View>
          <Text style={styles.dataHint}>{data.settings.androidExportDirectoryUri ? "Download folder saved for next time." : "Android will ask where to save the backup."}</Text>
        </View>
        <View style={styles.dataSection}>
          <Text style={styles.dataSectionTitle}>Import backup</Text>
          <Text style={styles.warningText}>Import replaces the local Amy data on this device. Use a full Amy JSON export.</Text>
          <View style={styles.exportActions}>
            <IconAction icon={<Upload size={18} color={colors.ink} strokeWidth={3} />} label="Choose file" onPress={importFile} />
            <IconAction
              icon={<FileText size={18} color={colors.ink} strokeWidth={3} />}
              label={showPasteImport ? "Hide paste" : "Paste JSON"}
              onPress={() => setShowPasteImport((visible) => !visible)}
            />
          </View>
        </View>
        {showPasteImport ? (
          <View style={styles.pastePanel}>
            <TextInput
              value={importValue}
              onChangeText={setImportValue}
              multiline
              placeholder="Paste Amy JSON export"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.importBox]}
            />
            <IconAction
              icon={<Upload size={18} color={colors.ink} strokeWidth={3} />}
              label="Import pasted JSON"
              onPress={applyImport}
              grow={false}
              disabled={!hasImportValue}
            />
          </View>
        ) : null}
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
  sectionHeader: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  statusPill: {
    minHeight: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  statusPillText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900"
  },
  goalLine: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  fieldGroup: {
    flex: 1,
    minWidth: 0,
    gap: 7
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900"
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
    flexDirection: "row",
    gap: 8,
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
  macroDot: {
    width: 10,
    height: 10,
    borderRadius: 999
  },
  macroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  autoButton: {
    minHeight: 34,
    borderRadius: 999,
    justifyContent: "center",
    paddingHorizontal: 14,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  autoButtonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  macroInputRow: {
    flexDirection: "row",
    gap: 10
  },
  macroInputField: {
    flex: 1,
    minWidth: 0,
    gap: 7
  },
  macroInputLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  macroInputLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  macroTargetInput: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: colors.panel2,
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    paddingHorizontal: 12,
    textAlign: "center"
  },
  macroCalHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
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
  dataCounts: {
    flexDirection: "row",
    gap: 10
  },
  dataCount: {
    flex: 1,
    minHeight: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel2
  },
  dataCountValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900"
  },
  dataCountLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900"
  },
  safetyBox: {
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  safetyCopy: {
    flex: 1,
    gap: 3
  },
  safetyTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  dataSection: {
    gap: 10,
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 13
  },
  dataSectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  dataHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  warningText: {
    color: colors.orange,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800"
  },
  actionButton: {
    minHeight: 52,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  actionButtonGrow: {
    flex: 1
  },
  actionButtonPrimary: {
    backgroundColor: colors.purple,
    borderColor: colors.purple
  },
  actionButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  actionButtonTextPrimary: {
    color: colors.ink
  },
  pastePanel: {
    gap: 10
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
