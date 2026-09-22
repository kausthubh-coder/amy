export const integrationConfig = {
  openRouter: {
    // Used only after the user supplies an OpenRouter key. Not a first-launch network call.
    // Web search is only attached to requests that mention a brand, chain, or venue.
    webSearchEnabled: true,
    defaultModel: "google/gemini-3.1-flash-lite",
    fallbackModel: "google/gemini-3-flash-preview",
    defaultVisionModel: "google/gemini-3.1-flash-lite",
    fallbackVisionModel: "google/gemini-3-flash-preview",
    keysUrl: "https://openrouter.ai/keys"
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
