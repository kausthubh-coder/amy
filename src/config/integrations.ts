const openRouterApiKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY?.trim() ?? "";
const openRouterModel = process.env.EXPO_PUBLIC_OPENROUTER_MODEL?.trim() || "google/gemini-3.5-flash";
const openRouterWebSearch = process.env.EXPO_PUBLIC_OPENROUTER_WEB_SEARCH?.trim() !== "false";

export const integrationConfig = {
  openRouter: {
    apiKey: openRouterApiKey,
    model: openRouterModel,
    webSearchEnabled: openRouterWebSearch,
    configured: openRouterApiKey.length > 0 && openRouterApiKey !== "sk-or-your-key"
  },
  openFoodFacts: {
    baseUrl: "https://world.openfoodfacts.org",
    configured: true
  }
};

export const privacyBoundary = {
  localData: "Diary, saved meals, goals, corrections, exports, and imports stay in local device storage.",
  allowedCloud:
    "Open Food Facts is used for barcode/product lookup. OpenRouter is used only for AI meal estimates when a key is configured."
};
