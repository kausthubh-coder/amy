import { Platform } from "react-native";

import { integrationConfig } from "../config/integrations";
import { scaleMacros } from "../domain/nutrition";
import { FoodDraft, FoodPortion, MacroTotals, PortionUnit } from "../domain/types";
import { createId } from "../domain/seed";

type OpenFoodFactsNutriments = Record<string, unknown>;

type OpenFoodFactsProduct = {
  code?: unknown;
  product_name?: unknown;
  product_name_en?: unknown;
  brands?: unknown;
  serving_size?: unknown;
  serving_quantity?: unknown;
  quantity?: unknown;
  nutriments?: OpenFoodFactsNutriments;
  image_front_url?: unknown;
};

type OpenFoodFactsResponse = {
  status?: unknown;
  status_verbose?: unknown;
  product?: OpenFoodFactsProduct;
};

export type ProductLookupResult =
  | { status: "found"; draft: FoodDraft }
  | { status: "not-found"; message: string; detail?: string }
  | { status: "error"; message: string; detail?: string };

const fields = [
  "code",
  "product_name",
  "product_name_en",
  "brands",
  "serving_size",
  "serving_quantity",
  "quantity",
  "nutriments",
  "image_front_url"
].join(",");

function toNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function nutriment(nutriments: OpenFoodFactsNutriments | undefined, name: string, scope: "serving" | "100g") {
  if (!nutriments) return undefined;
  const scoped = toNumber(nutriments[`${name}_${scope}`]);
  if (scoped !== undefined) return scoped;
  return scope === "100g" ? toNumber(nutriments[name]) : undefined;
}

function roundedMacros(calories: number, carbs: number, protein: number, fat: number): MacroTotals {
  return {
    calories: Math.max(0, Math.round(calories)),
    carbs: Math.max(0, Math.round(carbs * 10) / 10),
    protein: Math.max(0, Math.round(protein * 10) / 10),
    fat: Math.max(0, Math.round(fat * 10) / 10)
  };
}

function macroSet(product: OpenFoodFactsProduct, scope: "serving" | "100g"): MacroTotals | null {
  const nutriments = product.nutriments;
  const calories = nutriment(nutriments, "energy-kcal", scope);
  const protein = nutriment(nutriments, "proteins", scope);
  const carbs = nutriment(nutriments, "carbohydrates", scope);
  const fat = nutriment(nutriments, "fat", scope);

  if (calories === undefined || protein === undefined || carbs === undefined || fat === undefined) return null;

  return roundedMacros(calories, carbs, protein, fat);
}

function gramsFromText(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|grams?|oz)\b/i);
  if (!match) return undefined;
  const amount = Number(match[1]?.replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const unit = match[2]?.toLowerCase();
  if (unit === "kg") return amount * 1000;
  if (unit === "oz") return amount * 28.3495;
  return amount;
}

function formatGrams(value: number): string {
  return `${Number(value.toFixed(1))} g`;
}

function servingGramsFromProduct(product: OpenFoodFactsProduct): number | undefined {
  const servingText = firstText(product.serving_size);
  const parsedFromLabel = gramsFromText(servingText);
  if (parsedFromLabel !== undefined) return parsedFromLabel;
  const servingQuantity = toNumber(product.serving_quantity);
  if (servingQuantity !== undefined && servingQuantity > 0 && (!servingText || /\b(g|grams?|kg|oz)\b/i.test(servingText))) return servingQuantity;
  return undefined;
}

type ProductNutrition = {
  macros: MacroTotals;
  servingLabel: string;
  portion: FoodPortion;
};

function productNutrition(product: OpenFoodFactsProduct): ProductNutrition | null {
  const servingGrams = servingGramsFromProduct(product);
  const servingLabel = firstText(product.serving_size) ?? (servingGrams ? formatGrams(servingGrams) : "1 serving");
  const servingMacros = macroSet(product, "serving");
  const per100g = macroSet(product, "100g");

  if (servingMacros) {
    return {
      macros: servingMacros,
      servingLabel,
      portion: {
        amount: 1,
        unit: "serving",
        servingLabel,
        servingGrams,
        baseAmount: 1,
        baseUnit: "serving",
        baseMacros: servingMacros
      }
    };
  }

  if (!per100g) return null;

  if (servingGrams) {
    const macros = scaleMacros(per100g, servingGrams / 100);
    return {
      macros,
      servingLabel,
      portion: {
        amount: 1,
        unit: "serving",
        servingLabel,
        servingGrams,
        baseAmount: 1,
        baseUnit: "serving",
        baseMacros: macros
      }
    };
  }

  const baseUnit: PortionUnit = "g";
  return {
    macros: per100g,
    servingLabel: "100 g",
    portion: {
      amount: 100,
      unit: "g",
      servingLabel: "100 g",
      baseAmount: 100,
      baseUnit,
      baseMacros: per100g
    }
  };
}

export async function lookupOpenFoodFactsProduct(barcode: string, day: string): Promise<ProductLookupResult> {
  const normalized = barcode.trim();
  if (!normalized) return { status: "error", message: "No barcode yet.", detail: "Scan the package or type the number under the camera." };

  const url = `${integrationConfig.openFoodFacts.baseUrl}/api/v2/product/${encodeURIComponent(normalized)}.json?fields=${encodeURIComponent(fields)}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (Platform.OS !== "web") headers["User-Agent"] = "AmyCalorieTracker/1.0 (https://amy.local)";

  try {
    const response = await fetch(url, { headers });
    let body: OpenFoodFactsResponse = {};
    try {
      body = (await response.json()) as OpenFoodFactsResponse;
    } catch {
      body = {};
    }

    if (response.status === 404 || body.status !== 1 || !body.product) {
      return {
        status: "not-found",
        message: "No Open Food Facts match yet.",
        detail: "Try another angle, type the barcode, or log it as a photo meal."
      };
    }
    if (!response.ok) {
      return {
        status: "error",
        message: "Open Food Facts is having trouble.",
        detail: `Lookup failed with status ${response.status}. Try again in a moment.`
      };
    }

    const nutrition = productNutrition(body.product);
    if (!nutrition) {
      return {
        status: "not-found",
        message: "Product found, nutrition missing.",
        detail: "Open Food Facts does not have enough calories/macros for this item yet."
      };
    }

    const title = [firstText(body.product.brands), firstText(body.product.product_name, body.product.product_name_en)]
      .filter(Boolean)
      .join(" ");

    return {
      status: "found",
      draft: {
        id: createId("draft_off"),
        day,
        rawInput: normalized,
        title: title || `Barcode ${normalized}`,
        servingLabel: nutrition.servingLabel,
        macros: nutrition.macros,
        source: "open_food_facts",
        confidence: 0.92,
        sourceLabel: "Open Food Facts",
        portion: nutrition.portion,
        barcode: normalized,
        createdAt: new Date().toISOString()
      }
    };
  } catch {
    return {
      status: "error",
      message: "Could not reach Open Food Facts.",
      detail: "Check your connection or try the barcode again."
    };
  }
}
