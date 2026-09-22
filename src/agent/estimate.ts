import { integrationConfig } from "../config/integrations";
import { AgentError, runAgentChat } from "./client";
import { DraftParts, draftPartsFromLine, parseAgentPayload, parseModelJson } from "./parse";
import { AgentContext, imageUserPrompt, shouldUseWebSearch, systemPrompt, textUserPrompt } from "./prompt";

export type AgentSettings = {
  apiKey: string;
  model?: string;
  bias?: string;
};

export type LineEstimate =
  | { status: "ok"; draft: DraftParts; model: string }
  | { status: "not-food"; note?: string }
  | { status: "error"; error: AgentError };

const TEXT_TIMEOUT_MS = 35000;
const IMAGE_TIMEOUT_MS = 75000;

function textModels(preferred?: string) {
  return [preferred ?? "", integrationConfig.openRouter.defaultModel, integrationConfig.openRouter.fallbackModel];
}

function visionModels(preferred?: string) {
  return [preferred ?? "", integrationConfig.openRouter.defaultVisionModel, integrationConfig.openRouter.fallbackVisionModel];
}

/**
 * Estimates several typed lines in one request. The result array always lines up with `lines`.
 * Throws AgentError only when the whole request failed (no key, network, auth).
 */
export async function estimateTextLines(lines: string[], settings: AgentSettings, context?: AgentContext): Promise<LineEstimate[]> {
  const cleaned = lines.map((line) => line.trim());
  const webSearch = integrationConfig.openRouter.webSearchEnabled && cleaned.some(shouldUseWebSearch);
  const { content, model } = await runAgentChat({
    apiKey: settings.apiKey,
    models: textModels(settings.model),
    messages: [
      { role: "system", content: systemPrompt("text") },
      { role: "user", content: textUserPrompt(cleaned, context) }
    ],
    webSearch,
    timeoutMs: TEXT_TIMEOUT_MS
  });

  let parsed;
  try {
    parsed = parseAgentPayload(parseModelJson(content), "ai_text");
  } catch (error) {
    throw new AgentError("parse", error instanceof Error ? error.message : "The AI reply could not be read.");
  }

  return cleaned.map((line, index) => {
    const match = parsed.find((item) => item.line === index + 1) ?? (cleaned.length === 1 ? parsed[0] : undefined);
    if (!match) return { status: "error", error: new AgentError("parse", "The AI skipped this line. Tap to retry.") };
    const draft = draftPartsFromLine(match, line, { bias: settings.bias, source: "ai_text" });
    if (!draft) return { status: "not-food", note: match.assumptions || undefined };
    return { status: "ok", draft, model };
  });
}

export async function estimateImages(
  input: { dataUrls: string[]; mode: "photo" | "label"; note?: string },
  settings: AgentSettings,
  context?: AgentContext
): Promise<DraftParts> {
  if (!input.dataUrls.length) throw new AgentError("empty", "Add at least one photo first.");
  const webSearch = integrationConfig.openRouter.webSearchEnabled && input.mode === "photo" && shouldUseWebSearch(input.note ?? "");
  const { content } = await runAgentChat({
    apiKey: settings.apiKey,
    models: visionModels(settings.model),
    messages: [
      { role: "system", content: systemPrompt(input.mode) },
      {
        role: "user",
        content: [
          { type: "text", text: imageUserPrompt(input.mode, input.note, input.dataUrls.length, context) },
          ...input.dataUrls.map((url) => ({ type: "image_url", image_url: { url } }))
        ]
      }
    ],
    webSearch,
    timeoutMs: IMAGE_TIMEOUT_MS
  });

  const source = input.mode === "label" ? "label_ocr" : "ai_photo";
  let parsed;
  try {
    parsed = parseAgentPayload(parseModelJson(content), source);
  } catch (error) {
    throw new AgentError("parse", error instanceof Error ? error.message : "The AI reply could not be read.");
  }

  // Photos describe one meal, so every returned line folds into a single result.
  const merged = parsed.reduce(
    (all, line) => ({
      ...all,
      items: [...all.items, ...line.items],
      itemServings: [...all.itemServings, ...line.itemServings],
      assumptions: all.assumptions || line.assumptions
    }),
    { line: 1, items: [], itemServings: [], assumptions: "", sourceLabel: parsed[0]?.sourceLabel ?? "Amy estimate" } as (typeof parsed)[number]
  );
  const fallbackTitle = input.note?.trim() || (input.mode === "label" ? "Nutrition label" : "Meal photo");
  const draft = draftPartsFromLine(merged, merged.items.length > 1 ? merged.items.map((item) => item.title).join(", ") : fallbackTitle, {
    bias: settings.bias,
    source
  });
  if (!draft) {
    throw new AgentError(
      "empty",
      merged.assumptions || (input.mode === "label" ? "Amy could not read a nutrition label in these photos." : "Amy could not find food in these photos.")
    );
  }
  return draft;
}
