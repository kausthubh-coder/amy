const { createRunOncePlugin, withAppBuildGradle, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withAmyReleaseAndroid(config) {
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

module.exports = createRunOncePlugin(withAmyReleaseAndroid, "with-amy-release-android", "1.0.1");
