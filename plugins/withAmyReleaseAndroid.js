const { createRunOncePlugin, withAppBuildGradle, withDangerousMod, withGradleProperties } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function setGradleProperty(config, key, value) {
  const existing = config.modResults.find((item) => item.type === "property" && item.key === key);
  if (existing) {
    existing.value = value;
    return;
  }
  config.modResults.push({ type: "property", key, value });
}

function withAmyReleaseAndroid(config) {
  config = withGradleProperties(config, (config) => {
    // Compress native libs inside the APK so per-ABI release artifacts stay near Izzy's ~30MB guideline.
    setGradleProperty(config, "expo.useLegacyPackaging", "true");
    setGradleProperty(config, "android.bundle.enableUncompressedNativeLibs", "false");
    return config;
  });

  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const src = path.join(config.modRequest.projectRoot, "plugins/amy-release.gradle");
      const dest = path.join(config.modRequest.platformProjectRoot, "amy-release.gradle");
      fs.copyFileSync(src, dest);
      return config;
    }
  ]);

  return withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes("amy-release.gradle")) {
      config.modResults.contents += `\napply from: new File(rootProject.projectDir, "amy-release.gradle")\n`;
    }
    return config;
  });
}

module.exports = createRunOncePlugin(withAmyReleaseAndroid, "with-amy-release-android", "1.0.0");
