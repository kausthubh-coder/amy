import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Trash2 } from "lucide-react-native";

import { InteractivePressable } from "../components/InteractivePressable";
import { useToast } from "../components/Toast";
import { targetsFromCalories } from "../domain/nutrition";
import { useAppData } from "../store/AppDataContext";
import { colors } from "../theme";

export function SavedMealsModal({ onDone }: { onDone: () => void }) {
  const { data, selectedDay, logSavedMeal, addSavedMeal, deleteSavedMeal, restoreSavedMeal } = useAppData();
  const { showToast } = useToast();
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [calories, setCalories] = useState("");
  if (!data) return null;

  return (
    <View style={styles.stack}>
      {!data.savedMeals.length ? (
        <Text style={styles.empty}>No saved meals yet. Create one below, or open any logged food and tap "Save as meal". Typing a saved meal's name in your log fills it in instantly.</Text>
      ) : null}
      {data.savedMeals.map((meal) => (
        <View key={meal.id} style={styles.mealRow}>
          <View style={styles.mealCopy}>
            <Text style={styles.mealTitle} numberOfLines={2}>
              {meal.title}
            </Text>
            <Text style={styles.mealMeta}>🔥 {meal.macros.calories} · C {meal.macros.carbs} · P {meal.macros.protein} · F {meal.macros.fat}</Text>
          </View>
          <InteractivePressable
            accessibilityRole="button"
            accessibilityLabel={`Delete saved meal ${meal.title}`}
            feedbackKind="delete"
            onPress={() => {
              deleteSavedMeal(meal.id);
              showToast({ kind: "info", message: `Deleted "${meal.title}"`, actionLabel: "Undo", onAction: () => restoreSavedMeal(meal) });
            }}
            style={styles.deleteButton}
          >
            <Trash2 size={19} color={colors.muted} strokeWidth={2.4} />
          </InteractivePressable>
          <InteractivePressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${meal.title}, ${meal.macros.calories} calories`}
            feedbackKind="log"
            onPress={() => {
              logSavedMeal(meal.id, selectedDay);
              showToast({ kind: "success", message: `Logged ${meal.title}: ${meal.macros.calories.toLocaleString()} cal` });
              onDone();
            }}
            style={styles.addButton}
          >
            <Text style={styles.addText}>Add</Text>
          </InteractivePressable>
        </View>
      ))}

      <View style={styles.form}>
        <Text style={styles.formTitle}>Create quick meal</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="Meal name" placeholderTextColor={colors.dim} style={styles.input} />
        <TextInput value={calories} onChangeText={setCalories} placeholder="Calories" placeholderTextColor={colors.dim} keyboardType="number-pad" style={styles.input} />
        <InteractivePressable
          onPress={() => {
            const cals = Math.round(Number(calories.replace(",", ".")) || 0);
            if (!title.trim() || cals <= 0) {
              setError(!title.trim() ? "Give the meal a name." : "Enter the meal's calories.");
              return;
            }
            const split = targetsFromCalories(cals);
            addSavedMeal({
              title: title.trim(),
              servingLabel: "1 serving",
              macros: { calories: cals, carbs: split.carbsTarget, protein: split.proteinTarget, fat: split.fatTarget }
            });
            showToast({ kind: "success", message: `Saved "${title.trim()}". Macros are a typical split; edit them after logging.` });
            setError("");
            setTitle("");
            setCalories("");
          }}
          style={styles.createButton}
        >
          <Text style={styles.createText}>Save meal</Text>
        </InteractivePressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700"
  },
  mealCopy: {
    flex: 1,
    minWidth: 0
  },
  deleteButton: {
    width: 44,
    height: 48,
    alignItems: "center",
    justifyContent: "center"
  },
  error: {
    color: colors.pink,
    fontSize: 14,
    fontWeight: "800"
  },
  stack: {
    gap: 14
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 17,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel
  },
  mealTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  mealMeta: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  addButton: {
    minWidth: 78,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.purple
  },
  addText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  form: {
    gap: 10,
    padding: 17,
    borderRadius: 24,
    backgroundColor: colors.panel
  },
  formTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900"
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: colors.panel2,
    color: colors.ink,
    fontSize: 17,
    paddingHorizontal: 14
  },
  createButton: {
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.orange
  },
  createText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: "900"
  }
});
