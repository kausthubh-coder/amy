import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Bookmark, RefreshCw, X } from "lucide-react-native";

import { scaleMacroTotals, sumMacros } from "../agent/parse";
import { InteractivePressable } from "../components/InteractivePressable";
import { ModalShell } from "../components/ModalShell";
import { formatPortionLabel, macrosForPortion, portionGrams } from "../domain/nutrition";
import { FoodEntry, FoodItem, FoodPortion, MacroTotals, PortionUnit } from "../domain/types";
import { colors } from "../theme";

export type FoodFields = Pick<FoodEntry, "title" | "servingLabel" | "macros" | "portion" | "items">;

type EditableItem = { item: FoodItem; calories: string };

function numeric(value: string, fallback: number) {
  const parsed = Number(value.replace(/,/g, "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inputAmount(value: string): number | undefined {
  const parsed = Number(value.replace(/,/g, "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function formatInputAmount(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "";
  return Number(value.toFixed(2)).toString();
}

function servingAmountForPortion(portion: FoodPortion): number | undefined {
  if (portion.unit === "serving") return portion.amount;
  if (portion.servingGrams) return portion.amount / portion.servingGrams;
  return undefined;
}

function sameMacros(a: MacroTotals, b: MacroTotals) {
  return a.calories === b.calories && a.carbs === b.carbs && a.protein === b.protein && a.fat === b.fat;
}

export function confidenceLabel(entry: Pick<FoodEntry, "source" | "confidence" | "userEdited">) {
  if (entry.userEdited) return { text: "Your numbers", tone: "good" as const };
  if (entry.source === "manual") return { text: "Entered by you", tone: "good" as const };
  if (entry.source === "saved_meal") return { text: "Saved meal", tone: "good" as const };
  if (entry.source === "open_food_facts") return { text: "From Open Food Facts", tone: "good" as const };
  if (entry.confidence >= 0.8) return { text: "High confidence", tone: "good" as const };
  if (entry.confidence >= 0.6) return { text: "Medium confidence", tone: "ok" as const };
  return { text: "Low confidence, worth a check", tone: "low" as const };
}

function itemWithCalories(item: FoodItem, caloriesText: string): FoodItem {
  const calories = Math.max(0, Math.round(numeric(caloriesText, item.macros.calories)));
  if (calories === item.macros.calories) return item;
  if (item.macros.calories <= 0) return { ...item, macros: { ...item.macros, calories } };
  // Keep the macro split the agent found and scale it to the corrected calories.
  return { ...item, macros: { ...scaleMacroTotals(item.macros, calories / item.macros.calories), calories }, confidence: 1 };
}

export function FoodEditModal({
  entry,
  newLine,
  canReestimate,
  onClose,
  onSave,
  onCreate,
  onDelete,
  onReestimate,
  onSaveAsMeal
}: {
  entry?: FoodEntry;
  newLine?: string;
  canReestimate: boolean;
  onClose: () => void;
  onSave: (entry: FoodEntry, patch: Partial<FoodEntry>) => void;
  onCreate: (line: string, fields: FoodFields) => void;
  onDelete: (entry: FoodEntry) => void;
  onReestimate: (entry: FoodEntry) => void;
  onSaveAsMeal: (fields: FoodFields) => void;
}) {
  const [title, setTitle] = useState("");
  const [servingLabel, setServingLabel] = useState("");
  const [calories, setCalories] = useState("");
  const [carbs, setCarbs] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [portionServings, setPortionServings] = useState("");
  const [portionGramAmount, setPortionGramAmount] = useState("");
  const [activePortionUnit, setActivePortionUnit] = useState<PortionUnit>("serving");
  const [macrosDirty, setMacrosDirty] = useState(false);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [error, setError] = useState("");

  const creating = !entry && newLine !== undefined;
  const visible = Boolean(entry) || creating;

  const setMacroInputs = (macros: MacroTotals) => {
    setCalories(String(macros.calories));
    setCarbs(String(macros.carbs));
    setProtein(String(macros.protein));
    setFat(String(macros.fat));
  };

  useEffect(() => {
    setError("");
    setMacrosDirty(false);
    if (entry) {
      setTitle(entry.title);
      setServingLabel(entry.servingLabel);
      setMacroInputs(entry.macros);
      setItems((entry.items ?? []).map((item) => ({ item, calories: String(item.macros.calories) })));
      if (entry.portion) {
        setActivePortionUnit(entry.portion.unit);
        setPortionServings(formatInputAmount(servingAmountForPortion(entry.portion)));
        setPortionGramAmount(formatInputAmount(portionGrams(entry.portion)));
      } else {
        setActivePortionUnit("serving");
        setPortionServings("");
        setPortionGramAmount("");
      }
      return;
    }
    setTitle(newLine?.trim() ?? "");
    setServingLabel("1 serving");
    setCalories("");
    setCarbs("");
    setProtein("");
    setFat("");
    setItems([]);
    setPortionServings("");
    setPortionGramAmount("");
  }, [entry, newLine]);

  const portion = entry?.portion;
  const hasItems = items.length > 0;
  const canUseServings = portion ? portion.baseUnit === "serving" || Boolean(portion.servingGrams) : false;
  const canUseGrams = portion ? portion.baseUnit === "g" || Boolean(portion.servingGrams) : false;
  const itemTotals = useMemo(() => sumMacros(items.map((row) => itemWithCalories(row.item, row.calories).macros)), [items]);

  const syncPortion = (unit: PortionUnit, rawValue: string) => {
    if (!portion || macrosDirty) return;
    const amount = inputAmount(rawValue);
    if (amount === undefined) return;
    setMacroInputs(macrosForPortion({ ...portion, amount, unit }));
  };

  const changePortionServings = (value: string) => {
    setActivePortionUnit("serving");
    setPortionServings(value);
    const amount = inputAmount(value);
    if (amount !== undefined && portion?.servingGrams) setPortionGramAmount(formatInputAmount(amount * portion.servingGrams));
    syncPortion("serving", value);
  };

  const changePortionGrams = (value: string) => {
    setActivePortionUnit("g");
    setPortionGramAmount(value);
    const amount = inputAmount(value);
    if (amount !== undefined && portion?.servingGrams) setPortionServings(formatInputAmount(amount / portion.servingGrams));
    syncPortion("g", value);
  };

  const changeMacro = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setMacrosDirty(true);
  };

  const manualMacros = (fallback: MacroTotals): MacroTotals => ({
    calories: Math.max(0, Math.round(numeric(calories, fallback.calories))),
    carbs: Math.max(0, Math.round(numeric(carbs, fallback.carbs) * 10) / 10),
    protein: Math.max(0, Math.round(numeric(protein, fallback.protein) * 10) / 10),
    fat: Math.max(0, Math.round(numeric(fat, fallback.fat) * 10) / 10)
  });

  const buildFields = (): FoodFields | null => {
    const cleanTitle = title.trim() || entry?.title || newLine?.trim() || "";
    if (!cleanTitle) {
      setError("Give this food a name.");
      return null;
    }
    const empty = { calories: 0, carbs: 0, protein: 0, fat: 0 };

    if (hasItems) {
      const nextItems = items.map((row) => itemWithCalories(row.item, row.calories));
      return { title: cleanTitle, servingLabel: `${nextItems.length} ${nextItems.length === 1 ? "item" : "items"}`, macros: sumMacros(nextItems.map((item) => item.macros)), items: nextItems, portion: undefined };
    }

    if (portion) {
      const unit: PortionUnit = activePortionUnit === "g" && canUseGrams ? "g" : "serving";
      const fallbackAmount = unit === "g" ? (portionGrams(portion) ?? portion.amount) : (servingAmountForPortion(portion) ?? portion.amount);
      const amount = inputAmount(unit === "g" ? portionGramAmount : portionServings) ?? fallbackAmount;
      let nextPortion: FoodPortion = { ...portion, amount, unit };
      // Typing calories directly re-bases the portion, so later scaling starts from the user's numbers.
      if (macrosDirty) nextPortion = { ...nextPortion, baseAmount: amount, baseUnit: unit, baseMacros: manualMacros(entry?.macros ?? empty) };
      return { title: cleanTitle, servingLabel: formatPortionLabel(nextPortion), macros: macrosForPortion(nextPortion), portion: nextPortion, items: undefined };
    }

    if (creating && !calories.trim()) {
      setError("Enter the calories for this food.");
      return null;
    }
    return { title: cleanTitle, servingLabel: servingLabel.trim() || entry?.servingLabel || "1 serving", macros: manualMacros(entry?.macros ?? empty), portion: undefined, items: undefined };
  };

  const handleSave = () => {
    const fields = buildFields();
    if (!fields) return;
    if (!entry) {
      onCreate(newLine ?? fields.title, fields);
      return;
    }
    const nutritionChanged =
      !sameMacros(fields.macros, entry.macros) || (fields.items?.length ?? 0) !== (entry.items?.length ?? 0) || fields.portion?.amount !== entry.portion?.amount;
    onSave(entry, { ...fields, userEdited: entry.userEdited || nutritionChanged ? true : undefined, confidence: nutritionChanged ? 1 : entry.confidence });
  };

  const handleSaveAsMeal = () => {
    const fields = buildFields();
    if (fields) onSaveAsMeal(fields);
  };

  const status = entry ? confidenceLabel(entry) : null;
  const toneColor = status?.tone === "low" ? colors.orange : status?.tone === "ok" ? colors.yellow : colors.green;

  return (
    <ModalShell visible={visible} title={creating ? "Add calories" : "Edit Food"} onClose={onClose}>
      {visible ? (
        <View style={styles.stack}>
          {entry && status ? (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={[styles.toneDot, { backgroundColor: toneColor }]} />
                <Text style={styles.infoTitle}>{status.text}</Text>
                {entry.sourceLabel ? <Text style={styles.infoSource}>{entry.sourceLabel}</Text> : null}
              </View>
              {entry.assumptions ? <Text style={styles.infoText}>{entry.assumptions}</Text> : null}
            </View>
          ) : null}
          {creating ? <Text style={styles.infoText}>No AI key is set, so Amy will not guess. Enter what you know; only calories are required.</Text> : null}

          <View style={styles.card}>
            <Text style={styles.label}>Food</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Food name" placeholderTextColor={colors.dim} style={styles.input} accessibilityLabel="Food name" />
            {portion || hasItems ? null : (
              <TextInput
                value={servingLabel}
                onChangeText={setServingLabel}
                placeholder="Serving size"
                placeholderTextColor={colors.dim}
                style={styles.input}
                accessibilityLabel="Serving size"
              />
            )}
          </View>

          {hasItems ? (
            <View style={styles.card}>
              <Text style={styles.label}>Items in this line</Text>
              {items.map((row, index) => (
                <View key={`${row.item.title}-${index}`} style={styles.itemRow}>
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {row.item.title}
                    </Text>
                    <Text style={styles.itemMeta} numberOfLines={1}>
                      {row.item.servingLabel}
                      {row.item.confidence < 0.6 ? " · low confidence" : ""}
                    </Text>
                  </View>
                  <TextInput
                    value={row.calories}
                    onChangeText={(value) => setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, calories: value } : item)))}
                    keyboardType="number-pad"
                    selectTextOnFocus
                    style={styles.itemInput}
                    accessibilityLabel={`${row.item.title} calories`}
                  />
                  <InteractivePressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${row.item.title}`}
                    feedbackKind="delete"
                    onPress={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    style={styles.itemRemove}
                  >
                    <X size={18} color={colors.muted} strokeWidth={2.6} />
                  </InteractivePressable>
                </View>
              ))}
              <Text style={styles.hint}>
                Total {itemTotals.calories.toLocaleString()} cal · C {Math.round(itemTotals.carbs)} · P {Math.round(itemTotals.protein)} · F {Math.round(itemTotals.fat)}
              </Text>
            </View>
          ) : null}

          {portion && !hasItems ? (
            <View style={styles.card}>
              <Text style={styles.label}>How much did you have?</Text>
              <View style={styles.row}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Servings</Text>
                  <TextInput
                    value={portionServings}
                    onChangeText={changePortionServings}
                    editable={canUseServings}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    placeholder="1"
                    placeholderTextColor={colors.dim}
                    style={[styles.input, !canUseServings && styles.disabled]}
                    accessibilityLabel="Servings"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Grams</Text>
                  <TextInput
                    value={portionGramAmount}
                    onChangeText={changePortionGrams}
                    editable={canUseGrams}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    placeholder={canUseGrams ? "g" : "unknown"}
                    placeholderTextColor={colors.dim}
                    style={[styles.input, !canUseGrams && styles.disabled]}
                    accessibilityLabel="Grams"
                  />
                </View>
              </View>
              <Text style={styles.hint}>
                {formatInputAmount(portion.baseAmount)} {portion.baseUnit === "g" ? "g" : `x ${portion.servingLabel}`} = {portion.baseMacros.calories.toLocaleString()} cal
              </Text>
            </View>
          ) : null}

          {hasItems ? null : (
            <View style={styles.card}>
              <Text style={styles.label}>Nutrition total</Text>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Calories</Text>
                <TextInput
                  value={calories}
                  onChangeText={changeMacro(setCalories)}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  autoFocus={creating}
                  placeholder="0"
                  placeholderTextColor={colors.dim}
                  style={styles.input}
                  accessibilityLabel="Calories"
                />
              </View>
              <View style={styles.row}>
                {(
                  [
                    ["Carbs g", carbs, setCarbs, colors.pink],
                    ["Protein g", protein, setProtein, colors.blue],
                    ["Fat g", fat, setFat, colors.yellow]
                  ] as const
                ).map(([label, value, setter, color]) => (
                  <View key={label} style={styles.field}>
                    <Text style={[styles.fieldLabel, { color }]}>{label}</Text>
                    <TextInput
                      value={value}
                      onChangeText={changeMacro(setter)}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                      placeholder="0"
                      placeholderTextColor={colors.dim}
                      style={styles.input}
                      accessibilityLabel={label}
                    />
                  </View>
                ))}
              </View>
              {portion && macrosDirty ? <Text style={styles.hint}>Your numbers now define this portion; changing servings will scale from them.</Text> : null}
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {entry ? (
            <View style={styles.row}>
              {canReestimate ? (
                <InteractivePressable accessibilityRole="button" accessibilityHint="Asks the AI for a fresh estimate of this line." onPress={() => onReestimate(entry)} style={styles.secondary}>
                  <RefreshCw size={17} color={colors.ink} strokeWidth={2.6} />
                  <Text style={styles.secondaryText}>Re-estimate</Text>
                </InteractivePressable>
              ) : null}
              <InteractivePressable accessibilityRole="button" accessibilityHint="Adds this food to your saved meals." onPress={handleSaveAsMeal} style={styles.secondary}>
                <Bookmark size={17} color={colors.ink} strokeWidth={2.6} />
                <Text style={styles.secondaryText}>Save as meal</Text>
              </InteractivePressable>
            </View>
          ) : null}

          <View style={styles.row}>
            {entry ? (
              <InteractivePressable accessibilityRole="button" feedbackKind="delete" onPress={() => onDelete(entry)} style={[styles.action, styles.remove]}>
                <Text style={styles.removeText}>Remove</Text>
              </InteractivePressable>
            ) : null}
            <InteractivePressable accessibilityRole="button" feedbackKind="success" onPress={handleSave} style={[styles.action, styles.save]}>
              <Text style={styles.saveText}>{creating ? "Log it" : "Save"}</Text>
            </InteractivePressable>
          </View>
        </View>
      ) : null}
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  card: {
    gap: 10,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  infoCard: {
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  toneDot: {
    width: 10,
    height: 10,
    borderRadius: 999
  },
  infoTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  infoSource: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  infoText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700"
  },
  label: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "900"
  },
  row: {
    flexDirection: "row",
    gap: 10
  },
  field: {
    flex: 1,
    gap: 6
  },
  fieldLabel: {
    color: colors.dim,
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
  disabled: {
    opacity: 0.45
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19
  },
  error: {
    color: colors.pink,
    fontSize: 14,
    fontWeight: "800"
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  itemCopy: {
    flex: 1,
    minWidth: 0
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800"
  },
  itemMeta: {
    color: colors.dim,
    fontSize: 12,
    fontWeight: "800"
  },
  itemInput: {
    width: 84,
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: colors.panel2,
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "right",
    paddingHorizontal: 12
  },
  itemRemove: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  secondary: {
    flex: 1,
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
  secondaryText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
  action: {
    flex: 1,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  remove: {
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  save: {
    backgroundColor: colors.purple
  },
  removeText: {
    color: colors.pink,
    fontSize: 16,
    fontWeight: "900"
  },
  saveText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  }
});
