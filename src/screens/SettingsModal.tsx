import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import { StorageAccessFramework } from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Copy, Download, FileText, Save, ShieldCheck, Upload } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { checkOpenRouterKey } from "../agent/client";
import { ToastKind, useToast } from "../components/Toast";
import { CalorieBias } from "../domain/types";
import { ImportSummary } from "../store/AppDataContext";

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
  const numeric = Number(value.replace(",", "."));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function macroGrams(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function goalStatus(currentWeight: number, goalWeight: number) {
  if (currentWeight <= 0 || goalWeight <= 0) return { type: "Not set", status: "Enter your current and goal weight to track progress." };
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

const biasOptions: Array<{ value: CalorieBias; label: string; hint: string }> = [
  { value: "under_more", label: "-15%", hint: "AI estimates are lowered by 15%." },
  { value: "under", label: "-7%", hint: "AI estimates are lowered by 7%." },
  { value: "balanced", label: "As is", hint: "AI estimates are used unchanged." },
  { value: "over", label: "+7%", hint: "AI estimates are raised by 7%, a small safety margin." },
  { value: "over_more", label: "+15%", hint: "AI estimates are raised by 15%, a bigger safety margin." }
];

function deviceLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
  } catch {
    return "en-US";
  }
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
  const { data, selectedDay, updateGoal, updateSettings, logWeight, exportText, previewImport, importText } = useAppData();
  const { showToast } = useToast();
  const [calories, setCalories] = useState(String(data?.goal.dailyCalories ?? 2000));
  const [carbs, setCarbs] = useState(String(data?.goal.carbsTarget ?? 0));
  const [protein, setProtein] = useState(String(data?.goal.proteinTarget ?? 0));
  const [fat, setFat] = useState(String(data?.goal.fatTarget ?? 0));
  const [currentWeight, setCurrentWeight] = useState(data?.goal.currentWeightLbs ? String(data.goal.currentWeightLbs) : "");
  const [goalWeight, setGoalWeight] = useState(data?.goal.weightGoalLbs ? String(data.goal.weightGoalLbs) : "");
  const [weightNote, setWeightNote] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState(data?.settings.openRouterKey ?? "");
  const [openRouterModel, setOpenRouterModel] = useState(data?.settings.openRouterModel ?? integrationConfig.openRouter.defaultModel);
  const [importValue, setImportValue] = useState("");
  const [showPasteImport, setShowPasteImport] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ text: string; summary: ImportSummary } | null>(null);
  const [keyCheck, setKeyCheck] = useState<{ busy: boolean; message: string; ok?: boolean }>({ busy: false, message: "" });

  // Settings is a long sheet, so results are announced as toasts instead of text below the fold.
  const setNotice = (message: string, kind: ToastKind = "success") => showToast({ message, kind });

  // Import (or any outside change) refreshes the form instead of leaving stale numbers behind.
  const goal = data?.goal;
  useEffect(() => {
    if (!goal) return;
    setCalories(String(goal.dailyCalories));
    setCarbs(String(goal.carbsTarget));
    setProtein(String(goal.proteinTarget));
    setFat(String(goal.fatTarget));
    setCurrentWeight(goal.currentWeightLbs ? String(goal.currentWeightLbs) : "");
    setGoalWeight(goal.weightGoalLbs ? String(goal.weightGoalLbs) : "");
  }, [goal]);

  const pendingCalories = numberFromInput(calories, data?.goal.dailyCalories ?? 2000);

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
    setNotice("Macros balanced from calories. Tap Save goals to keep them.", "info");
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
    const weight = numberFromInput(currentWeight, 0);
    if (weight <= 0) {
      setNotice("Enter your current weight first.", "error");
      return;
    }
    logWeight(selectedDay, weight, weightNote);
    updateGoal({ weightGoalLbs: pendingGoalWeight });
    setWeightNote("");
    setNotice(`Weight logged for ${labelForDay(selectedDay)}.`);
  };

  const saveAiSettings = () => {
    updateSettings({
      openRouterKey: openRouterKey.trim(),
      openRouterModel: openRouterModel.trim() || integrationConfig.openRouter.defaultModel
    });
    setNotice(
      openRouterKey.trim() ? "OpenRouter key saved on this device." : "Key cleared. Amy will ask for calories instead of estimating.",
      openRouterKey.trim() ? "success" : "info"
    );
  };

  const testKey = async () => {
    setKeyCheck({ busy: true, message: "" });
    const result = await checkOpenRouterKey(openRouterKey);
    if (!result.ok) {
      setKeyCheck({ busy: false, ok: false, message: result.message });
      return;
    }
    const credit = result.remaining !== undefined ? ` · $${result.remaining.toFixed(2)} credit left` : "";
    setKeyCheck({ busy: false, ok: true, message: `Key works${credit}${result.freeTier ? " · free tier (rate limited)" : ""}` });
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
          setNotice("Export canceled.", "info");
          return;
        }
        if (result.directoryUri !== data.settings.androidExportDirectoryUri) {
          updateSettings({ androidExportDirectoryUri: result.directoryUri });
        }
        setNotice("Export downloaded to your selected folder.");
        return;
      } catch {
        setNotice("Could not write to that folder. Opening share options instead.", "error");
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

  // Import replaces everything, so it is always a two-step action with a preview of what arrives.
  const applyImportText = (text: string) => {
    try {
      setPendingImport({ text, summary: previewImport(text) });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Import failed. Use a full Amy JSON export.", "error");
    }
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    try {
      const summary = importText(pendingImport.text);
      setImportValue("");
      setShowPasteImport(false);
      const skipped = summary.dropped ? `; skipped ${summary.dropped} damaged records` : "";
      setNotice(`Imported ${summary.entries.toLocaleString()} foods${skipped}. Your API key was kept.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Import failed.", "error");
    }
    setPendingImport(null);
  };

  const applyImport = () => {
    if (!hasImportValue) {
      setNotice("Paste a full Amy JSON export first.", "error");
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
      setNotice("Could not read that file. Choose a full Amy JSON export.", "error");
    }
  };

  const toggleLocation = async (enabled: boolean) => {
    if (!enabled) {
      updateSettings({ locationForRestaurants: false });
      setNotice("Location context off.", "info");
      return;
    }

    const context = await getLocationContext({ fresh: true });
    updateSettings({ locationForRestaurants: Boolean(context.label) });
    setNotice(context.label ? `Location on. Estimates will use: ${context.label}` : (context.error ?? "Location unavailable."), context.label ? "success" : "error");
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
            <TextInput value={currentWeight} onChangeText={setCurrentWeight} keyboardType="decimal-pad" placeholder="e.g. 181.5" placeholderTextColor={colors.muted} style={styles.input} />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Goal lbs</Text>
            <TextInput value={goalWeight} onChangeText={setGoalWeight} keyboardType="decimal-pad" placeholder="e.g. 165" placeholderTextColor={colors.muted} style={styles.input} />
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
        <Text style={styles.rowSub}>The model is used for text and photos. Pick a vision-capable model if you use photo or label estimates.</Text>
        <View style={styles.exportActions}>
          <IconAction
            icon={keyCheck.busy ? <ActivityIndicator color={colors.ink} /> : <ShieldCheck size={18} color={colors.ink} strokeWidth={3} />}
            label="Test key"
            onPress={testKey}
            disabled={keyCheck.busy || !openRouterKey.trim()}
          />
          <IconAction icon={<Save size={18} color={colors.ink} strokeWidth={3} />} label="Save" onPress={saveAiSettings} variant="primary" />
        </View>
        {keyCheck.message ? <Text style={[styles.rowSub, { color: keyCheck.ok ? colors.green : colors.pink }]}>{keyCheck.message}</Text> : null}
        <InteractivePressable accessibilityRole="link" onPress={() => void Linking.openURL(integrationConfig.openRouter.keysUrl)} style={styles.linkButton}>
          <Text style={styles.linkText}>Get a key at openrouter.ai/keys</Text>
        </InteractivePressable>
        <Row icon="↕" title="Estimate adjustment" subtitle={biasOptions.find((option) => option.value === data.settings.calorieBias)?.hint} />
        <View style={[styles.segment, styles.segmentWide]}>
          {biasOptions.map((option) => {
            const selected = data.settings.calorieBias === option.value;
            return (
              <InteractivePressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={option.hint}
                accessibilityState={{ selected }}
                onPress={() => updateSettings({ calorieBias: option.value })}
                style={[styles.segmentItem, styles.segmentItemWide, selected && styles.segmentOn]}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextOn]}>{option.label}</Text>
              </InteractivePressable>
            );
          })}
        </View>
        <Row icon="⌖" title="Use rough location" subtitle="Sends only your area (city, region, country) with AI estimates, for restaurant and regional accuracy.">
          <Switch value={data.settings.locationForRestaurants} onValueChange={toggleLocation} trackColor={{ true: colors.green, false: colors.panel3 }} thumbColor={colors.ink} />
        </Row>
        <Row icon="🎙" title="Dictation language" subtitle={data.settings.dictationLanguage === "auto" ? `Follows your phone: ${deviceLocale()}` : data.settings.dictationLanguage} />
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
          <DataCount label="remembered" value={data.corrections.length} />
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
        {pendingImport ? (
          <View style={styles.confirmBox}>
            <Text style={styles.safetyTitle}>Replace everything on this device?</Text>
            <Text style={styles.privacy}>
              This backup has {pendingImport.summary.entries.toLocaleString()} foods, {pendingImport.summary.savedMeals} saved meals, and {pendingImport.summary.weightLogs} weight logs
              {pendingImport.summary.dropped ? ` (${pendingImport.summary.dropped} damaged records will be skipped)` : ""}. It replaces your current{" "}
              {data.entries.length.toLocaleString()} foods. Export first if you want to keep them.
            </Text>
            <View style={styles.exportActions}>
              <IconAction icon={<FileText size={18} color={colors.ink} strokeWidth={3} />} label="Cancel" onPress={() => setPendingImport(null)} />
              <IconAction icon={<Upload size={18} color={colors.ink} strokeWidth={3} />} label="Replace my data" onPress={confirmImport} variant="primary" />
            </View>
          </View>
        ) : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  segmentWide: {
    alignSelf: "stretch"
  },
  segmentItemWide: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  linkButton: {
    minHeight: 44,
    justifyContent: "center"
  },
  linkText: {
    color: colors.blue,
    fontSize: 14,
    fontWeight: "900"
  },
  confirmBox: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.orange,
    backgroundColor: "rgba(255, 152, 36, 0.1)"
  },
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
