import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { InteractivePressable } from "../components/InteractivePressable";
import { useAppData } from "../store/AppDataContext";
import { colors } from "../theme";

export function SavedMealsModal({ onDone }: { onDone: () => void }) {
  const { data, selectedDay, logSavedMeal, addSavedMeal } = useAppData();
  const [title, setTitle] = useState("");
  const [calories, setCalories] = useState("");
  if (!data) return null;

  return (
    <View style={styles.stack}>
      {data.savedMeals.map((meal) => (
        <View key={meal.id} style={styles.mealRow}>
          <View>
            <Text style={styles.mealTitle}>{meal.title}</Text>
            <Text style={styles.mealMeta}>🔥 {meal.macros.calories} · C {meal.macros.carbs} · P {meal.macros.protein} · F {meal.macros.fat}</Text>
          </View>
          <InteractivePressable
            feedbackKind="success"
            onPress={() => {
              logSavedMeal(meal.id, selectedDay);
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
            const cals = Number(calories) || 0;
            if (!title.trim() || cals <= 0) return;
            addSavedMeal({
              title: title.trim(),
              servingLabel: "1 serving",
              macros: { calories: cals, carbs: Math.round(cals * 0.5 / 4), protein: Math.round(cals * 0.2 / 4), fat: Math.round(cals * 0.3 / 9) }
            });
            setTitle("");
            setCalories("");
          }}
          style={styles.createButton}
        >
          <Text style={styles.createText}>Save meal</Text>
        </InteractivePressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
