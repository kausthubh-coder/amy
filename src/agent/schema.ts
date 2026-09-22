// Structured-output contract shared by every agent flow (typed lines, meal photos, label photos).

export type AgentItem = {
  title?: unknown;
  name?: unknown;
  servingLabel?: unknown;
  servings?: unknown;
  grams?: unknown;
  calories?: unknown;
  carbs?: unknown;
  protein?: unknown;
  fat?: unknown;
  confidence?: unknown;
};

export type AgentLine = {
  line?: unknown;
  items?: unknown;
  assumptions?: unknown;
  sourceLabel?: unknown;
};

export type AgentPayload = {
  lines?: unknown;
  // Older single-request shape, still accepted from models that ignore the schema.
  items?: unknown;
  assumptions?: unknown;
  sourceLabel?: unknown;
};

const itemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "Short editable food name, e.g. 'Turkey sandwich'." },
    servingLabel: { type: "string", description: "Human portion eaten, e.g. '2 large eggs', '1 cup cooked', '12 fl oz can'." },
    servings: { type: "number", description: "How many servings were eaten. 1 unless the user stated a count." },
    grams: { type: "number", description: "Estimated total weight eaten in grams (ml for drinks). 0 if unknown." },
    calories: { type: "number", description: "Total kcal for the amount eaten." },
    carbs: { type: "number", description: "Total grams of carbohydrate for the amount eaten." },
    protein: { type: "number", description: "Total grams of protein for the amount eaten." },
    fat: { type: "number", description: "Total grams of fat for the amount eaten." },
    confidence: { type: "number", description: "0-1, following the confidence rubric." }
  },
  required: ["title", "servingLabel", "servings", "grams", "calories", "carbs", "protein", "fat", "confidence"]
};

export const agentResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          line: { type: "integer", description: "The input line number this result belongs to." },
          items: { type: "array", items: itemSchema },
          assumptions: { type: "string", description: "One short sentence (max 140 chars) stating the portion assumptions made." },
          sourceLabel: { type: "string", enum: ["Amy estimate", "Restaurant estimate", "Label estimate"] }
        },
        required: ["line", "items", "assumptions", "sourceLabel"]
      }
    }
  },
  required: ["lines"]
};

export const agentResponseFormat = {
  type: "json_schema",
  json_schema: { name: "amy_food_estimate", strict: true, schema: agentResponseSchema }
};
