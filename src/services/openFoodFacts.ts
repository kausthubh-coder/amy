import { Platform } from "react-native";

import { integrationConfig } from "../config/integrations";
import { FoodDraft, MacroTotals } from "../domain/types";
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
  | { status: "not-found"; message: string }
  | { status: "error"; message: string };

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
  return toNumber(nutriments[`${name}_${scope}`] ?? nutriments[name]);
}

function macrosFromProduct(product: OpenFoodFactsProduct): MacroTotals | null {
  const nutriments = product.nutriments;
  const hasServing = nutriment(nutriments, "energy-kcal", "serving") !== undefined;
  const scope = hasServing ? "serving" : "100g";
  const calories = nutriment(nutriments, "energy-kcal", scope) ?? nutriment(nutriments, "energy-kcal", "100g");
  const protein = nutriment(nutriments, "proteins", scope) ?? nutriment(nutriments, "proteins", "100g");
  const carbs = nutriment(nutriments, "carbohydrates", scope) ?? nutriment(nutriments, "carbohydrates", "100g");
  const fat = nutriment(nutriments, "fat", scope) ?? nutriment(nutriments, "fat", "100g");

  if (calories === undefined || protein === undefined || carbs === undefined || fat === undefined) return null;

  return {
    calories: Math.max(0, Math.round(calories)),
    carbs: Math.max(0, Math.round(carbs * 10) / 10),
    protein: Math.max(0, Math.round(protein * 10) / 10),
    fat: Math.max(0, Math.round(fat * 10) / 10)
  };
}

export async function lookupOpenFoodFactsProduct(barcode: string, day: string): Promise<ProductLookupResult> {
  const normalized = barcode.trim();
  if (!normalized) return { status: "error", message: "No barcode was scanned." };

  const url = `${integrationConfig.openFoodFacts.baseUrl}/api/v2/product/${encodeURIComponent(normalized)}.json?fields=${encodeURIComponent(fields)}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (Platform.OS !== "web") headers["User-Agent"] = "AmyCalorieTracker/1.0 (https://amy.local)";

  try {
    const response = await fetch(url, { headers });
    const body = (await response.json()) as OpenFoodFactsResponse;

    if (!response.ok) return { status: "error", message: `Open Food Facts failed (${response.status}).` };
    if (body.status !== 1 || !body.product) return { status: "not-found", message: "This barcode was not found in Open Food Facts." };

    const macros = macrosFromProduct(body.product);
    if (!macros) return { status: "not-found", message: "Open Food Facts found this product, but it is missing calories or macros." };

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
        servingLabel: firstText(body.product.serving_size, body.product.quantity) ?? "1 serving",
        macros,
        source: "open_food_facts",
        confidence: 0.92,
        sourceLabel: "Open Food Facts",
        barcode: normalized,
        createdAt: new Date().toISOString()
      }
    };
  } catch {
    return { status: "error", message: "Could not reach Open Food Facts. Check connection and try again." };
  }
}
