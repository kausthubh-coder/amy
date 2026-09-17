import { agentResponseFormat } from "./schema";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export type AgentErrorKind = "no-key" | "auth" | "credits" | "rate" | "timeout" | "network" | "model" | "parse" | "empty";

export class AgentError extends Error {
  kind: AgentErrorKind;
  constructor(kind: AgentErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
  /** Errors another model or another attempt cannot fix. */
  get fatal() {
    return this.kind === "no-key" || this.kind === "auth" || this.kind === "credits" || this.kind === "rate";
  }
}

type ChatMessage = { role: "system" | "user"; content: unknown };

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
  error?: { message?: string };
};

function contentText(content: unknown): string {
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

function headers(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://openamy.app",
    "X-OpenRouter-Title": "Amy"
  };
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new AgentError("timeout", "The estimate took too long. Check your connection and retry.");
    throw new AgentError("network", error instanceof Error && /network/i.test(error.message) ? "No connection. Retry when you are back online." : "Could not reach OpenRouter. Check your connection and retry.");
  } finally {
    clearTimeout(timer);
  }
}

function errorForStatus(status: number, detail: string | undefined, model: string): AgentError {
  if (status === 401 || status === 403) return new AgentError("auth", "OpenRouter rejected the API key. Check it in Settings.");
  if (status === 402) return new AgentError("credits", "Your OpenRouter account is out of credits.");
  if (status === 429) return new AgentError("rate", "OpenRouter is rate limiting this key. Wait a moment and retry.");
  if (status === 400 || status === 404 || status === 422) return new AgentError("model", detail ? `${model}: ${detail}` : `The model "${model}" rejected the request.`);
  return new AgentError("network", detail ?? `OpenRouter failed (${status}).`);
}

async function requestOnce(options: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  webSearch: boolean;
  structured: boolean;
  timeoutMs: number;
}): Promise<string> {
  const response = await fetchWithTimeout(
    ENDPOINT,
    {
      method: "POST",
      headers: headers(options.apiKey),
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        response_format: options.structured ? agentResponseFormat : { type: "json_object" },
        tools: options.webSearch
          ? [{ type: "openrouter:web_search", parameters: { engine: "auto", max_results: 4, search_context_size: "medium" } }]
          : undefined,
        temperature: 0.1
      })
    },
    options.timeoutMs
  );

  const textBody = await response.text();
  let body: ChatCompletionResponse = {};
  try {
    body = JSON.parse(textBody) as ChatCompletionResponse;
  } catch {
    body = {};
  }

  if (!response.ok) throw errorForStatus(response.status, body.error?.message, options.model);
  if (body.error?.message) throw new AgentError("model", body.error.message);
  const content = contentText(body.choices?.[0]?.message?.content);
  if (!content) throw new AgentError("empty", "The AI model returned an empty reply.");
  return content;
}

/**
 * Tries each model in order. Per model it first asks for strict structured output with the
 * requested tools, then degrades to plain JSON mode without tools, because not every provider
 * behind OpenRouter supports json_schema or server tools.
 */
export async function runAgentChat(options: {
  apiKey: string;
  models: string[];
  messages: ChatMessage[];
  webSearch: boolean;
  timeoutMs: number;
}): Promise<{ content: string; model: string }> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new AgentError("no-key", "Add an OpenRouter key in Settings for AI estimates.");
  const models = Array.from(new Set(options.models.map((model) => model.trim()).filter(Boolean)));
  let lastError: AgentError | undefined;

  for (const model of models) {
    const attempts = [
      { structured: true, webSearch: options.webSearch },
      { structured: false, webSearch: false }
    ];
    for (const attempt of attempts) {
      try {
        const content = await requestOnce({ apiKey, model, messages: options.messages, timeoutMs: options.timeoutMs, ...attempt });
        return { content, model };
      } catch (error) {
        lastError = error instanceof AgentError ? error : new AgentError("network", error instanceof Error ? error.message : "OpenRouter failed.");
        if (lastError.fatal || lastError.kind === "timeout" || lastError.kind === "network") break;
      }
    }
    // A different model cannot fix a bad key, empty wallet, or dead connection.
    if (lastError?.fatal || lastError?.kind === "timeout" || lastError?.kind === "network") break;
  }

  throw lastError ?? new AgentError("network", "OpenRouter failed.");
}

export type KeyCheck = { ok: true; label: string; remaining?: number; freeTier: boolean } | { ok: false; message: string };

export async function checkOpenRouterKey(apiKey: string): Promise<KeyCheck> {
  const key = apiKey.trim();
  if (!key) return { ok: false, message: "Paste a key first." };
  try {
    const response = await fetchWithTimeout("https://openrouter.ai/api/v1/key", { headers: headers(key) }, 12000);
    if (response.status === 401 || response.status === 403) return { ok: false, message: "OpenRouter does not recognize this key." };
    if (!response.ok) return { ok: false, message: `OpenRouter could not verify the key (${response.status}).` };
    const body = (await response.json()) as { data?: { label?: string; limit_remaining?: number | null; is_free_tier?: boolean } };
    const remaining = typeof body.data?.limit_remaining === "number" ? body.data.limit_remaining : undefined;
    return { ok: true, label: body.data?.label ?? "OpenRouter key", remaining, freeTier: Boolean(body.data?.is_free_tier) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not reach OpenRouter." };
  }
}
