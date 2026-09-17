const { createRunOncePlugin, withAppBuildGradle, withDangerousMod, withGradleProperties } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// AsyncStorage caps its database at 6 MB by default. The diary is sharded by month, but years of
// logging still add up, so give it room well before anyone can hit the ceiling.
function withAmyStorageSize(config) {
  return withGradleProperties(config, (config) => {
    const key = "AsyncStorage_db_size_in_MB";
    config.modResults = config.modResults.filter((item) => !(item.type === "property" && item.key === key));
    config.modResults.push({ type: "property", key, value: "64" });
    return config;
  });
}

function withAmyReleaseAndroid(config) {
  config = withAmyStorageSize(config);
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

module.exports = createRunOncePlugin(withAmyReleaseAndroid, "with-amy-release-android", "1.1.0");
