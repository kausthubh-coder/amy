import assert from "node:assert/strict";
import { test } from "node:test";

import { AgentError, checkOpenRouterKey, runAgentChat } from "../src/agent/client";
import { estimateImages, estimateTextLines } from "../src/agent/estimate";

type Call = { url: string; body: Record<string, unknown> | null; headers: Record<string, string>; signal?: AbortSignal };

/** Replaces global fetch with a fake OpenRouter for one test, recording every request. */
function withFetch(handler: (call: Call, index: number) => Response | Promise<Response>, run: (calls: Call[]) => Promise<void>) {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null,
      headers: (init?.headers as Record<string, string>) ?? {},
      signal: init?.signal ?? undefined
    };
    calls.push(call);
    return handler(call, calls.length - 1);
  }) as typeof fetch;
  return run(calls).finally(() => {
    globalThis.fetch = original;
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function reply(payload: unknown) {
  return json({ choices: [{ message: { content: JSON.stringify(payload) } }] });
}

// Macros that agree with the calories, so validation leaves the numbers alone.
function item(title: string, calories: number) {
  return { title, servingLabel: "1 serving", servings: 1, grams: 100, calories, carbs: calories / 8, protein: calories / 16, fat: calories / 36, confidence: 0.8 };
}

test("typed lines come back as drafts, not-food notes, or per-line errors", async () => {
  await withFetch(
    () =>
      reply({
        lines: [
          { line: 1, items: [{ title: "Oatmeal", servingLabel: "1 cup cooked", servings: 1, grams: 234, calories: 158, carbs: 27, protein: 6, fat: 3, confidence: 0.7 }], assumptions: "Assumed 1 cup cooked.", sourceLabel: "Amy estimate" },
          { line: 2, items: [], assumptions: "Not food.", sourceLabel: "Amy estimate" }
        ]
      }),
    async (calls) => {
      const results = await estimateTextLines(["oatmeal", "felt tired", "coffee"], { apiKey: "sk-or-test" }, { now: new Date(2026, 9, 22, 8, 0), locale: "en-US" });
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.url, "https://openrouter.ai/api/v1/chat/completions");
      assert.equal(calls[0]?.headers.Authorization, "Bearer sk-or-test");
      const messages = calls[0]?.body?.messages as Array<{ role: string; content: string }>;
      assert.match(messages[1]?.content ?? "", /1\. oatmeal\n2\. felt tired\n3\. coffee/);

      assert.equal(results.length, 3);
      const first = results[0];
      assert.equal(first?.status, "ok");
      if (first?.status === "ok") {
        assert.equal(first.draft.title, "Oatmeal");
        assert.equal(first.draft.macros.calories, 158);
        assert.equal(first.draft.portion?.servingGrams, 234);
        assert.equal(first.draft.assumptions, "Assumed 1 cup cooked.");
      }
      assert.deepEqual(results[1], { status: "not-food", note: "Not food." });
      const third = results[2];
      assert.equal(third?.status, "error");
      if (third?.status === "error") assert.equal(third.error.message, "The AI skipped this line. Tap to retry.");
    }
  );
});

test("a model that rejects structured output gets plain JSON mode before another model is tried", async () => {
  await withFetch(
    (_, index) => (index === 0 ? json({ error: { message: "response_format is not supported" } }, 400) : reply({ lines: [{ line: 1, items: [item("Coffee", 5)], assumptions: "", sourceLabel: "Amy estimate" }] })),
    async (calls) => {
      const [result] = await estimateTextLines(["coffee"], { apiKey: "sk-or-test", model: "test/model" });
      assert.equal(result?.status, "ok");
      if (result?.status === "ok") assert.equal(result.model, "test/model");
      assert.equal(calls.length, 2);
      assert.equal(calls[0]?.body?.model, "test/model");
      assert.equal((calls[0]?.body?.response_format as { type: string }).type, "json_schema");
      assert.equal(calls[1]?.body?.model, "test/model");
      assert.deepEqual(calls[1]?.body?.response_format, { type: "json_object" });
      assert.equal(calls[1]?.body?.tools, undefined);
    }
  );
});

test("a rejected key fails fast, with no retries and no fallback model", async () => {
  await withFetch(
    () => json({ error: { message: "User not found." } }, 401),
    async (calls) => {
      await assert.rejects(estimateTextLines(["coffee"], { apiKey: "sk-or-bad" }), (error: unknown) => error instanceof AgentError && error.kind === "auth" && error.fatal);
      assert.equal(calls.length, 1);
      await assert.rejects(estimateTextLines(["coffee"], { apiKey: "   " }), (error: unknown) => error instanceof AgentError && error.kind === "no-key");
      assert.equal(calls.length, 1);
    }
  );
});

test("a hung request times out instead of estimating forever", async () => {
  await withFetch(
    (call) =>
      new Promise<Response>((_, reject) => {
        call.signal?.addEventListener("abort", () => reject(new Error("The operation was aborted.")));
      }),
    async (calls) => {
      await assert.rejects(
        runAgentChat({ apiKey: "sk-or-test", models: ["a/model", "b/model"], messages: [{ role: "user", content: "coffee" }], webSearch: false, timeoutMs: 20 }),
        (error: unknown) => error instanceof AgentError && error.kind === "timeout"
      );
      assert.equal(calls.length, 1);
    }
  );
});

test("web search is only attached when the line names a brand or venue", async () => {
  await withFetch(
    () => reply({ lines: [{ line: 1, items: [item("Meal", 600)], assumptions: "", sourceLabel: "Restaurant estimate" }] }),
    async (calls) => {
      await estimateTextLines(["big mac meal from McDonalds"], { apiKey: "sk-or-test" });
      await estimateTextLines(["2 eggs"], { apiKey: "sk-or-test" });
      assert.ok(Array.isArray(calls[0]?.body?.tools));
      assert.equal(calls[1]?.body?.tools, undefined);
    }
  );
});

test("photo estimates fold every returned line into one reviewable meal", async () => {
  await withFetch(
    () =>
      reply({
        lines: [
          { line: 1, items: [item("Rice", 200), item("Chicken", 300)], assumptions: "Assumed 1 cup rice.", sourceLabel: "Amy estimate" },
          { line: 2, items: [item("Salad", 50)], assumptions: "", sourceLabel: "Amy estimate" }
        ]
      }),
    async (calls) => {
      const draft = await estimateImages({ dataUrls: ["data:image/jpeg;base64,AAAA"], mode: "photo" }, { apiKey: "sk-or-test" });
      assert.equal(draft.items?.length, 3);
      assert.equal(draft.macros.calories, 550);
      assert.equal(draft.title, "Rice, Chicken, Salad");
      assert.equal(draft.assumptions, "Assumed 1 cup rice.");
      const messages = calls[0]?.body?.messages as Array<{ content: unknown }>;
      const parts = messages[1]?.content as Array<{ type: string }>;
      assert.deepEqual(
        parts.map((part) => part.type),
        ["text", "image_url"]
      );
    }
  );
});

test("a photo with no food is an error that explains why, never a zero-calorie entry", async () => {
  await withFetch(
    () => reply({ lines: [{ line: 1, items: [], assumptions: "The photo shows a keyboard.", sourceLabel: "Amy estimate" }] }),
    async () => {
      await assert.rejects(
        estimateImages({ dataUrls: ["data:image/jpeg;base64,AAAA"], mode: "photo" }, { apiKey: "sk-or-test" }),
        (error: unknown) => error instanceof AgentError && error.kind === "empty" && error.message === "The photo shows a keyboard."
      );
    }
  );
});

test("Test key reports remaining credit and rejects unknown keys", async () => {
  await withFetch(
    (call) => (call.headers.Authorization === "Bearer sk-good" ? json({ data: { label: "Amy", limit_remaining: 4.2, is_free_tier: false } }) : json({ error: "bad" }, 401)),
    async () => {
      assert.deepEqual(await checkOpenRouterKey("sk-good"), { ok: true, label: "Amy", remaining: 4.2, freeTier: false });
      assert.deepEqual(await checkOpenRouterKey("sk-bad"), { ok: false, message: "OpenRouter does not recognize this key." });
      assert.deepEqual(await checkOpenRouterKey("   "), { ok: false, message: "Paste a key first." });
    }
  );
});

test("a reply of null is a readable error, not a crash", async () => {
  await withFetch(
    () => json({ choices: [{ message: { content: "null" } }] }),
    async () => {
      await assert.rejects(
        estimateTextLines(["coffee"], { apiKey: "sk-or-test" }),
        (error: unknown) => error instanceof AgentError && error.kind === "parse" && error.message === "The AI model replied with text instead of nutrition data."
      );
    }
  );
});
