export const integrationConfig = {
  openRouter: {
    webSearchEnabled: true,
    defaultModel: "google/gemini-3.5-flash"
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
