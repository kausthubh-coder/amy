import { File } from "expo-file-system";
import { Platform } from "react-native";

import { integrationConfig } from "../config/integrations";
import { FoodDraft, FoodSource, MacroTotals } from "../domain/types";
import { createId } from "../domain/seed";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
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

export type ImageEstimateInput = {
  uri: string;
  dataUrl?: string;
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
  if (source !== "open_food_facts" && /open food facts/i.test(candidate)) {
    return source === "label_ocr" ? "Label estimate" : "Amy estimate";
  }
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

function messageContentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part === "object" && part && "text" in part && typeof part.text === "string") return part.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
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
  "Use current common nutrition knowledge and any rough location context provided for restaurant guesses.",
  "Open Food Facts is the only product database this app uses for barcode products; do not cite FatSecret, USDA, or another nutrition database as the product lookup source.",
  "Use sourceLabel values like Amy estimate or Restaurant estimate for text estimates, Amy agent for photo estimates, and Open Food Facts only for product matches backed by that source.",
  "For photo estimates, identify visible foods with short editable titles. Never use a local file name, URI, or generic 'image' label as the food title.",
  "When portions are uncertain, choose a practical serving estimate, include visible sauces/oils/sides, and lower confidence instead of undercounting.",
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

function buildImageUserText(prompt: string, caption?: string, context?: EstimateContext) {
  const lines = [prompt.trim()];
  if (caption?.trim()) lines.push(`User note: ${caption.trim()}`);
  lines.push("Use all attached photos together as one calorie-tracking request.");
  lines.push("You may use web search for product or restaurant context. Prefer Open Food Facts for packaged-food evidence when it is available.");
  if (context?.locationLabel) lines.push(`Rough location context for restaurant guesses: ${context.locationLabel}.`);
  if (context?.calorieBias && context.calorieBias !== "balanced") lines.push(`User calorie bias preference: ${context.calorieBias}.`);
  return lines.join("\n");
}

async function imageUriToDataUrl(image: ImageEstimateInput): Promise<string> {
  if (image.dataUrl?.startsWith("data:image/")) return image.dataUrl;
  if (Platform.OS === "web") {
    if (image.uri.startsWith("data:image/") || /^https?:\/\//i.test(image.uri)) return image.uri;
    throw new Error("Could not read this browser image. Choose it from gallery again.");
  }
  const base64 = await new File(image.uri).base64();
  const mime = image.uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${base64}`;
}

async function requestImageEstimate({
  apiKey,
  model,
  dataUrls,
  prompt,
  caption,
  context
}: {
  apiKey: string;
  model: string;
  dataUrls: string[];
  prompt: string;
  caption?: string;
  context?: EstimateContext;
}) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://amy.local",
      "X-OpenRouter-Title": "Amy Local"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: buildImageUserText(prompt, caption, context) },
            ...dataUrls.map((url) => ({ type: "image_url", image_url: { url } }))
          ]
        }
      ],
      response_format: { type: "json_object" },
      tools: integrationConfig.openRouter.webSearchEnabled
        ? [{ type: "openrouter:web_search", parameters: { engine: "auto", max_results: 5, search_context_size: "medium" } }]
        : undefined,
      temperature: 0.05
    })
  });

  const textBody = await response.text();
  let body: ChatCompletionResponse = {};
  try {
    body = JSON.parse(textBody) as ChatCompletionResponse;
  } catch {
    body = {};
  }

  if (!response.ok) throw new Error(body.error?.message ?? `OpenRouter failed (${response.status}).`);

  const content = messageContentText(body.choices?.[0]?.message?.content);
  if (!content) throw new Error("OpenRouter returned no content.");
  return content;
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

    const modelPayload = parseModelJson(messageContentText(content));
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
  images,
  day,
  mode,
  caption,
  context
}: {
  images: ImageEstimateInput[];
  day: string;
  mode: "photo" | "label";
  caption?: string;
  context?: EstimateContext;
}): Promise<{ drafts: FoodDraft[]; notice?: string; error?: string }> {
  const source: FoodSource = mode === "label" ? "label_ocr" : "ai_photo";
  const apiKey = context?.openRouterKey?.trim() ?? "";

  if (!apiKey) {
    return { drafts: [], error: "Add an OpenRouter key in Settings for AI image estimates." };
  }

  try {
    const selectedImages = images.filter((image) => image.uri.trim());
    if (!selectedImages.length) throw new Error("Add at least one food photo first.");
    const dataUrls = await Promise.all(selectedImages.map(imageUriToDataUrl));
    const prompt =
      mode === "label"
        ? "Act as Amy's calorie-tracking agent. Read the attached nutrition-label or package photos, use product context when needed, and return the calories and macros for the portion the user is logging. Use short editable food titles."
        : "Act as Amy's calorie-tracking agent. Inspect the attached meal photos, use web/product context when helpful, identify the visible foods, and estimate the calories and macros for what the user likely ate. Be practical and conservative.";
    const preferredModel = context?.openRouterModel?.trim() || integrationConfig.openRouter.defaultVisionModel;
    const modelAttempts = Array.from(new Set([preferredModel, integrationConfig.openRouter.defaultVisionModel, integrationConfig.openRouter.fallbackVisionModel]));
    let content = "";
    let lastError = "";

    for (const model of modelAttempts) {
      try {
        content = await requestImageEstimate({ apiKey, model, dataUrls, prompt, caption, context });
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "OpenRouter image analysis failed.";
      }
    }

    if (!content) throw new Error(lastError || "OpenRouter image analysis failed.");

    const modelPayload = parseModelJson(content);
    const items = Array.isArray(modelPayload.items) ? modelPayload.items : [];
    const drafts = items
      .map((item, index) => {
        if (typeof item !== "object" || !item) return null;
        const aiItem = item as AiItem;
        const rawInput = caption?.trim() || text(aiItem.title ?? aiItem.name, mode === "label" ? "Nutrition label photo" : "Meal photo");
        return itemToDraft(aiItem, day, rawInput, index, source);
      })
      .filter((draft): draft is FoodDraft => Boolean(draft))
      .map((draft) => ({ ...draft, imageUri: selectedImages[0]?.uri }));

    const unique = uniqueDrafts(drafts);
    if (!unique.length) throw new Error("OpenRouter returned no usable image estimate.");
    return { drafts: unique, notice: mode === "label" ? "Label estimate ready." : "Photo estimate ready." };
  } catch (error) {
    return {
      drafts: [],
      error: error instanceof Error ? error.message : "OpenRouter image analysis failed."
    };
  }
}
