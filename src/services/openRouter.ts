import { File } from "expo-file-system";
import { Platform } from "react-native";

import { integrationConfig } from "../config/integrations";
import { FoodDraft, FoodSource, MacroTotals } from "../domain/types";
import { createId } from "../domain/seed";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

type AiItem = {
  title?: unknown;
  name?: unknown;
  servingLabel?: unknown;
  calories?: unknown;
  carbs?: unknown;
  protein?: unknown;
  fat?: unknown;
  confidence?: unknown;
  sourceLabel?: unknown;
};

type AiPayload = {
  items?: unknown;
};

function toNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanSourceLabel(value: unknown, source: FoodSource): string {
  const candidate = text(value, source === "open_food_facts" ? "Open Food Facts" : "Amy estimate");
  if (source === "ai_text") {
    if (/menu|restaurant|chick-fil-a|mcdonald|taco bell|starbucks|chipotle/i.test(candidate)) return "Restaurant estimate";
    return "Amy estimate";
  }
  if (/usda|fatsecret|myfitnesspal|cronometer|nutritionix/i.test(candidate)) return "Amy estimate";
  return candidate;
}

function parseModelJson(content: string): AiPayload {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed) as AiPayload;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("AI provider returned text instead of JSON.");
    return JSON.parse(trimmed.slice(start, end + 1)) as AiPayload;
  }
}

type EstimateContext = {
  calorieBias?: string;
  locationLabel?: string;
  openRouterKey?: string;
  openRouterModel?: string;
};

function localEstimate(prompt: string, day: string, source: FoodSource = "local_fallback"): FoodDraft {
  const lower = prompt.toLowerCase();
  let macros: MacroTotals = { calories: 520, carbs: 52, protein: 28, fat: 22 };
  if (lower.includes("chick") || lower.includes("chick-fil-a")) macros = { calories: 1150, carbs: 102, protein: 33, fat: 69 };
  if (lower.includes("egg")) macros = { calories: 390, carbs: 34, protein: 22, fat: 18 };
  if (lower.includes("salad")) macros = { calories: 530, carbs: 31, protein: 42, fat: 28 };

  return {
    id: createId("draft_local"),
    day,
    rawInput: prompt,
    title: prompt.trim() || "Estimated meal",
    servingLabel: "1 serving",
    macros,
    source,
    confidence: 0.55,
    sourceLabel: "Local estimate",
    createdAt: new Date().toISOString()
  };
}

function itemToDraft(item: AiItem, day: string, rawInput: string, index: number, source: FoodSource = "ai_text"): FoodDraft | null {
  const calories = toNumber(item.calories);
  const carbs = toNumber(item.carbs);
  const protein = toNumber(item.protein);
  const fat = toNumber(item.fat);
  if (calories === undefined || carbs === undefined || protein === undefined || fat === undefined) return null;

  return {
    id: createId(`draft_ai_${index}`),
    day,
    rawInput,
    title: text(item.title ?? item.name, "Estimated meal"),
    servingLabel: text(item.servingLabel, "1 serving"),
    macros: {
      calories: Math.max(0, Math.round(calories)),
      carbs: Math.max(0, Math.round(carbs * 10) / 10),
      protein: Math.max(0, Math.round(protein * 10) / 10),
      fat: Math.max(0, Math.round(fat * 10) / 10)
    },
    source,
    confidence: clamp(toNumber(item.confidence) ?? 0.72),
    sourceLabel: cleanSourceLabel(item.sourceLabel, source),
    createdAt: new Date().toISOString()
  };
}

function draftFingerprint(draft: FoodDraft) {
  return [
    draft.day,
    draft.title.trim().toLowerCase().replace(/\s+/g, " "),
    draft.servingLabel.trim().toLowerCase().replace(/\s+/g, " "),
    draft.macros.calories,
    Math.round(draft.macros.carbs),
    Math.round(draft.macros.protein),
    Math.round(draft.macros.fat)
  ].join("|");
}

function uniqueDrafts(drafts: FoodDraft[]): FoodDraft[] {
  const seen = new Set<string>();
  return drafts.filter((draft) => {
    const key = draftFingerprint(draft);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const systemPrompt = [
  "You are Amy, a calorie tracking parser. Convert the user's meal note into nutrition items.",
  "Use current common nutrition knowledge and web search when available for restaurants or branded meals.",
  "Open Food Facts is the only product database this app uses for barcode products; do not cite FatSecret, USDA, or another nutrition database as the product lookup source.",
  "Use sourceLabel values like Amy estimate or Restaurant estimate for text/photo estimates; use Open Food Facts only for barcode product matches.",
  "Return only JSON with this shape:",
  '{"items":[{"title":"string","servingLabel":"string","calories":number,"carbs":number,"protein":number,"fat":number,"confidence":number,"sourceLabel":"string"}]}',
  "Prefer realistic calories over overly optimistic numbers. Include sauce, drinks, and sides when mentioned.",
  "No markdown, no explanation."
].join("\n");

const foodItemsSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          servingLabel: { type: "string" },
          calories: { type: "number" },
          carbs: { type: "number" },
          protein: { type: "number" },
          fat: { type: "number" },
          confidence: { type: "number" },
          sourceLabel: { type: "string" }
        },
        required: ["title", "servingLabel", "calories", "carbs", "protein", "fat", "confidence", "sourceLabel"]
      }
    }
  },
  required: ["items"]
};

function buildUserContent(prompt: string, context?: EstimateContext) {
  const lines = [prompt.trim()];
  if (context?.locationLabel) lines.push(`Rough location context for restaurant guesses: ${context.locationLabel}.`);
  if (context?.calorieBias && context.calorieBias !== "balanced") lines.push(`User calorie bias preference: ${context.calorieBias}.`);
  return lines.join("\n");
}

async function imageUriToDataUrl(uri: string): Promise<string> {
  if (Platform.OS === "web") return uri;
  const base64 = await new File(uri).base64();
  const mime = uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${base64}`;
}

export async function estimateMealText(prompt: string, day: string, context?: EstimateContext): Promise<{ drafts: FoodDraft[]; notice?: string; error?: string }> {
  const fallback = localEstimate(prompt, day);
  const apiKey = context?.openRouterKey?.trim() ?? "";
  if (!apiKey) {
    return { drafts: [fallback], notice: "Add an OpenRouter key in Settings for AI estimates." };
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://amy.local",
        "X-OpenRouter-Title": "Amy Local"
      },
      body: JSON.stringify({
        model: context?.openRouterModel?.trim() || integrationConfig.openRouter.defaultModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildUserContent(prompt, context) }
        ],
        response_format: { type: "json_object" },
        tools: integrationConfig.openRouter.webSearchEnabled
          ? [{ type: "openrouter:web_search", parameters: { engine: "auto", max_results: 4, search_context_size: "medium" } }]
          : undefined,
        temperature: 0.05
      })
    });

    const textBody = await response.text();
    let payload: ChatCompletionResponse = {};
    try {
      payload = JSON.parse(textBody) as ChatCompletionResponse;
    } catch {
      payload = {};
    }

    if (!response.ok) throw new Error(payload.error?.message ?? `OpenRouter failed (${response.status}).`);
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned no content.");

    const modelPayload = parseModelJson(content);
    const items = Array.isArray(modelPayload.items) ? modelPayload.items : [];
    const drafts = items
      .map((item, index) => (typeof item === "object" && item ? itemToDraft(item as AiItem, day, prompt, index) : null))
      .filter((draft): draft is FoodDraft => Boolean(draft));

    const unique = uniqueDrafts(drafts);
    if (!unique.length) throw new Error("OpenRouter returned no usable food items.");
    return { drafts: unique, notice: "AI estimate ready." };
  } catch (error) {
    return {
      drafts: [fallback],
      notice: "OpenRouter was unavailable. Amy kept an editable local estimate.",
      error: error instanceof Error ? error.message : "OpenRouter failed."
    };
  }
}

export async function estimateMealImage({
  imageUri,
  day,
  mode,
  caption,
  context
}: {
  imageUri: string;
  day: string;
  mode: "photo" | "label";
  caption?: string;
  context?: EstimateContext;
}): Promise<{ drafts: FoodDraft[]; notice?: string; error?: string }> {
  const source: FoodSource = mode === "label" ? "label_ocr" : "ai_photo";
  const fallback = localEstimate(caption || (mode === "label" ? "Nutrition label photo" : "Meal photo"), day, source);
  const apiKey = context?.openRouterKey?.trim() ?? "";

  if (!apiKey) {
    return { drafts: [fallback], notice: "Add an OpenRouter key in Settings for AI image estimates." };
  }

  try {
    const dataUrl = await imageUriToDataUrl(imageUri);
    const prompt =
      mode === "label"
        ? "Read this nutrition label. Return calories and macros for one normal serving."
        : "Estimate calories and macros for the visible meal. Be practical and conservative.";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://amy.local",
        "X-OpenRouter-Title": "Amy Local"
      },
      body: JSON.stringify({
        model: context?.openRouterModel?.trim() || integrationConfig.openRouter.defaultModel,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: caption ? `${prompt}\nUser note: ${caption}` : prompt },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.05
      })
    });

    const body = (await response.json()) as ChatCompletionResponse;
    if (!response.ok) throw new Error(body.error?.message ?? `OpenRouter failed (${response.status}).`);

    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned no content.");

    const modelPayload = parseModelJson(content);
    const items = Array.isArray(modelPayload.items) ? modelPayload.items : [];
    const drafts = items
      .map((item, index) => (typeof item === "object" && item ? itemToDraft(item as AiItem, day, caption || imageUri, index, source) : null))
      .filter((draft): draft is FoodDraft => Boolean(draft))
      .map((draft) => ({ ...draft, imageUri }));

    const unique = uniqueDrafts(drafts);
    if (!unique.length) throw new Error("OpenRouter returned no usable image estimate.");
    return { drafts: unique, notice: mode === "label" ? "Label estimate ready." : "Photo estimate ready." };
  } catch (error) {
    return {
      drafts: [{ ...fallback, imageUri }],
      notice: "OpenRouter image analysis was unavailable. Amy kept an editable fallback.",
      error: error instanceof Error ? error.message : "OpenRouter image analysis failed."
    };
  }
}
