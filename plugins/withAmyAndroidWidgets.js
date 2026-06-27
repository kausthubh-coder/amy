const { createRunOncePlugin, withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, contents) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, contents.trimStart());
}

function addReceiver(androidManifest, name, label, providerXml) {
  const application = androidManifest.manifest.application?.[0];
  if (!application) return androidManifest;

  application.receiver = application.receiver || [];
  const existing = application.receiver.find((receiver) => receiver.$?.["android:name"] === name);
  if (existing) return androidManifest;

  application.receiver.push({
    $: {
      "android:name": name,
      "android:exported": "true",
      "android:label": label
    },
    "intent-filter": [
      {
        action: [{ $: { "android:name": "android.appwidget.action.APPWIDGET_UPDATE" } }]
      }
    ],
    "meta-data": [
      {
        $: {
          "android:name": "android.appwidget.provider",
          "android:resource": `@xml/${providerXml}`
        }
      }
    ]
  });

  return androidManifest;
}

const widgetBackground = `
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
  <solid android:color="#242426" />
  <corners android:radius="28dp" />
  <stroke android:width="1dp" android:color="#424247" />
</shape>
`;

const widgetChip = `
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
  <solid android:color="#343438" />
  <corners android:radius="18dp" />
</shape>
`;

const widgetPrimaryChip = `
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
  <solid android:color="#FF9824" />
  <corners android:radius="18dp" />
</shape>
`;

const widgetIconMic = `
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="24dp"
  android:height="24dp"
  android:viewportWidth="24"
  android:viewportHeight="24">
  <path android:fillColor="#159BFF" android:pathData="M12,14c1.66,0 3,-1.34 3,-3V5c0,-1.66 -1.34,-3 -3,-3S9,3.34 9,5v6c0,1.66 1.34,3 3,3zM17.3,11c0,3 -2.54,5.1 -5.3,5.1S6.7,14 6.7,11H5c0,3.41 2.72,6.23 6,6.72V21h2v-3.28c3.28,-0.49 6,-3.31 6,-6.72h-1.7z" />
</vector>
`;

const widgetIconCamera = `
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="24dp"
  android:height="24dp"
  android:viewportWidth="24"
  android:viewportHeight="24">
  <path android:fillColor="#F141FF" android:pathData="M20,5h-3.17l-1.84,-2H9.01L7.17,5H4c-1.1,0 -2,0.9 -2,2v12c0,1.1 0.9,2 2,2h16c1.1,0 2,-0.9 2,-2V7c0,-1.1 -0.9,-2 -2,-2zM12,18c-2.76,0 -5,-2.24 -5,-5s2.24,-5 5,-5s5,2.24 5,5s-2.24,5 -5,5zM12,16.2c1.77,0 3.2,-1.43 3.2,-3.2S13.77,9.8 12,9.8S8.8,11.23 8.8,13s1.43,3.2 3.2,3.2z" />
</vector>
`;

const widgetIconPlus = `
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="24dp"
  android:height="24dp"
  android:viewportWidth="24"
  android:viewportHeight="24">
  <path android:fillColor="#FF9824" android:pathData="M19,13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
</vector>
`;

const widgetIconBarcode = `
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="24dp"
  android:height="24dp"
  android:viewportWidth="24"
  android:viewportHeight="24">
  <path android:fillColor="#FFFFFF" android:pathData="M3,4h2v16H3zM6.5,4h1v16h-1zM9,4h2v16H9zM12.5,4h1v16h-1zM15,4h1.5v16H15zM18,4h3v16h-3z" />
</vector>
`;

const caloriesLayout = `
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/amy_widget_calories_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:background="@drawable/amy_widget_background"
  android:gravity="center_vertical"
  android:orientation="horizontal"
  android:padding="16dp">
  <TextView
    android:id="@+id/amy_widget_calories_icon"
    android:layout_width="50dp"
    android:layout_height="50dp"
    android:background="@drawable/amy_widget_chip"
    android:gravity="center"
    android:text="🔥"
    android:textColor="#FF9824"
    android:textSize="24sp"
    android:textStyle="bold" />
  <LinearLayout
    android:layout_width="0dp"
    android:layout_height="wrap_content"
    android:layout_marginStart="12dp"
    android:layout_weight="1"
    android:orientation="vertical">
    <TextView
      android:id="@+id/amy_widget_calories_date"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:text="Today"
      android:textColor="#A1A1AA"
      android:textSize="13sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/amy_widget_calories_value"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:text="0"
      android:textColor="#FF9824"
      android:textSize="29sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/amy_widget_calories_label"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:text="calories logged"
      android:textColor="#F6F6F6"
      android:textSize="14sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/amy_widget_calories_macro"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:layout_marginTop="8dp"
      android:background="@drawable/amy_widget_chip"
      android:paddingLeft="12dp"
      android:paddingRight="12dp"
      android:paddingTop="6dp"
      android:paddingBottom="6dp"
      android:text="C0  P0  F0"
      android:textColor="#FFFFFF"
      android:textSize="12sp"
      android:textStyle="bold" />
  </LinearLayout>
</LinearLayout>
`;

const todayLayout = `
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/amy_widget_today_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:background="@drawable/amy_widget_background"
  android:clipToPadding="false"
  android:orientation="vertical"
  android:padding="10dp">
  <TextView
    android:id="@+id/amy_widget_prompt"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginBottom="6dp"
    android:gravity="center_vertical"
    android:singleLine="true"
    android:text="Quick log"
    android:textColor="#A1A1AA"
    android:textSize="12sp"
    android:textStyle="bold" />
  <LinearLayout
    android:id="@+id/amy_widget_primary_row"
    android:layout_width="match_parent"
    android:layout_height="0dp"
    android:layout_weight="1"
    android:gravity="center_vertical"
    android:minHeight="42dp"
    android:orientation="horizontal">
    <TextView
      android:id="@+id/amy_widget_type"
      android:layout_width="0dp"
      android:layout_height="match_parent"
      android:layout_weight="2.25"
      android:background="@drawable/amy_widget_primary_chip"
      android:ellipsize="end"
      android:gravity="center"
      android:maxLines="1"
      android:minHeight="42dp"
      android:paddingLeft="10dp"
      android:paddingRight="10dp"
      android:text="+ Type meal"
      android:textColor="#171717"
      android:textSize="15sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/amy_widget_today_link"
      android:layout_width="0dp"
      android:layout_height="match_parent"
      android:layout_marginStart="8dp"
      android:layout_weight="1"
      android:background="@drawable/amy_widget_chip"
      android:ellipsize="end"
      android:gravity="center"
      android:maxLines="1"
      android:minHeight="42dp"
      android:paddingLeft="8dp"
      android:paddingRight="8dp"
      android:text="Today"
      android:textColor="#F6F6F6"
      android:textSize="13sp"
      android:textStyle="bold" />
  </LinearLayout>
  <LinearLayout
    android:id="@+id/amy_widget_action_row"
    android:layout_width="match_parent"
    android:layout_height="42dp"
    android:layout_marginTop="8dp"
    android:gravity="center_vertical"
    android:orientation="horizontal">
    <ImageView
      android:id="@+id/amy_widget_mic"
      android:layout_width="0dp"
      android:layout_height="42dp"
      android:layout_weight="1"
      android:background="@drawable/amy_widget_chip"
      android:contentDescription="Mic"
      android:padding="10dp"
      android:scaleType="center"
      android:src="@drawable/amy_widget_icon_mic" />
    <ImageView
      android:id="@+id/amy_widget_camera"
      android:layout_width="0dp"
      android:layout_height="42dp"
      android:layout_marginStart="6dp"
      android:layout_weight="1"
      android:background="@drawable/amy_widget_chip"
      android:contentDescription="Photo"
      android:padding="10dp"
      android:scaleType="center"
      android:src="@drawable/amy_widget_icon_camera" />
    <ImageView
      android:id="@+id/amy_widget_saved"
      android:layout_width="0dp"
      android:layout_height="42dp"
      android:layout_marginStart="6dp"
      android:layout_weight="1"
      android:background="@drawable/amy_widget_chip"
      android:contentDescription="Saved meals"
      android:padding="10dp"
      android:scaleType="center"
      android:src="@drawable/amy_widget_icon_plus" />
    <ImageView
      android:id="@+id/amy_widget_barcode"
      android:layout_width="0dp"
      android:layout_height="42dp"
      android:layout_marginStart="6dp"
      android:layout_weight="1"
      android:background="@drawable/amy_widget_chip"
      android:contentDescription="Barcode"
      android:padding="10dp"
      android:scaleType="center"
      android:src="@drawable/amy_widget_icon_barcode" />
  </LinearLayout>
</LinearLayout>
`;

const caloriesInfo = `
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/app_name"
  android:initialLayout="@layout/amy_widget_calories"
  android:minWidth="170dp"
  android:minHeight="92dp"
  android:minResizeWidth="150dp"
  android:minResizeHeight="82dp"
  android:previewLayout="@layout/amy_widget_calories"
  android:resizeMode="horizontal|vertical"
  android:targetCellWidth="3"
  android:targetCellHeight="2"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen" />
`;

const todayInfo = `
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/app_name"
  android:initialLayout="@layout/amy_widget_today"
  android:minWidth="238dp"
  android:minHeight="146dp"
  android:minResizeWidth="184dp"
  android:minResizeHeight="112dp"
  android:previewLayout="@layout/amy_widget_today"
  android:resizeMode="horizontal|vertical"
  android:targetCellWidth="4"
  android:targetCellHeight="3"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen" />
`;

function stateJava(packageName) {
  return `
package ${packageName};

import android.content.Context;
import org.json.JSONObject;
import java.text.NumberFormat;
import java.util.Locale;

public class AmyWidgetState {
  private static final String PREFS = "amy_widget_state";
  private static final String KEY_JSON = "state_json";

  public String dayLabel = "Today";
  public int caloriesConsumed = 0;
  public int caloriesGoal = 2632;
  public int caloriesRemaining = 2632;
  public int carbs = 0;
  public int protein = 0;
  public int fat = 0;

  public static AmyWidgetState read(Context context) {
    AmyWidgetState state = new AmyWidgetState();
    String json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_JSON, null);
    if (json == null) return state;

    try {
      JSONObject object = new JSONObject(json);
      state.dayLabel = object.optString("dayLabel", state.dayLabel);
      state.caloriesConsumed = object.optInt("caloriesConsumed", state.caloriesConsumed);
      state.caloriesGoal = object.optInt("caloriesGoal", state.caloriesGoal);
      state.caloriesRemaining = object.optInt("caloriesRemaining", Math.max(0, state.caloriesGoal - state.caloriesConsumed));
      state.carbs = object.optInt("carbs", state.carbs);
      state.protein = object.optInt("protein", state.protein);
      state.fat = object.optInt("fat", state.fat);
    } catch (Exception ignored) {
    }

    return state;
  }

  public static void write(Context context, String json) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_JSON, json).apply();
  }

  public String remainingLabel() {
    return format(caloriesRemaining);
  }

	  public String consumedLabel() {
	    return format(caloriesConsumed);
	  }

	  public String macroLine() {
	    return "C" + carbs + "  P" + protein + "  F" + fat;
	  }

  private String format(int value) {
    return NumberFormat.getIntegerInstance(Locale.US).format(value);
  }
}
`;
}

function updaterJava(packageName) {
  return `
package ${packageName};

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

public final class AmyWidgetUpdater {
  private AmyWidgetUpdater() {}

  public static void updateAll(Context context) {
    updateProvider(context, AmyCaloriesWidgetProvider.class);
    updateProvider(context, AmyTodayWidgetProvider.class);
  }

  private static void updateProvider(Context context, Class<?> providerClass) {
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    int[] ids = manager.getAppWidgetIds(new ComponentName(context, providerClass));
    if (ids == null || ids.length == 0) return;
    Intent intent = new Intent(context, providerClass);
    intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
    intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
    context.sendBroadcast(intent);
  }
}
`;
}

function moduleJava(packageName) {
  return `
package ${packageName};

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class AmyWidgetModule extends ReactContextBaseJavaModule {
  public AmyWidgetModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "AmyWidgetModule";
  }

  @ReactMethod
  public void updateWidgetState(String json, Promise promise) {
    try {
      AmyWidgetState.write(getReactApplicationContext(), json);
      AmyWidgetUpdater.updateAll(getReactApplicationContext());
      promise.resolve(true);
    } catch (Exception error) {
      promise.reject("AMY_WIDGET_UPDATE_FAILED", error);
    }
  }
}
`;
}

function packageJava(packageName) {
  return `
package ${packageName};

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class AmyWidgetPackage implements ReactPackage {
  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
    return Arrays.<NativeModule>asList(new AmyWidgetModule(reactContext));
  }

  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }
}
`;
}

function caloriesProvider(packageName) {
  return `
package ${packageName};

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
	import android.content.Context;
	import android.content.Intent;
	import android.net.Uri;
	import android.os.Bundle;
	import android.widget.RemoteViews;

public class AmyCaloriesWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    AmyWidgetState state = AmyWidgetState.read(context);
    for (int appWidgetId : appWidgetIds) {
	      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.amy_widget_calories);
	      views.setTextViewText(R.id.amy_widget_calories_value, state.consumedLabel());
	      views.setTextViewText(R.id.amy_widget_calories_label, "calories logged");
	      views.setTextViewText(R.id.amy_widget_calories_macro, state.macroLine());
	      views.setTextViewText(R.id.amy_widget_calories_date, state.dayLabel);
	      views.setOnClickPendingIntent(R.id.amy_widget_calories_root, openIntent(context, "amy://today", 101));
	      views.setOnClickPendingIntent(R.id.amy_widget_calories_value, openIntent(context, "amy://today", 102));
      appWidgetManager.updateAppWidget(appWidgetId, views);
    }
	  }

	  @Override
	  public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
	    onUpdate(context, appWidgetManager, new int[] { appWidgetId });
	  }

	  private PendingIntent openIntent(Context context, String url, int requestCode) {
    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
    intent.setPackage(context.getPackageName());
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }
}
`;
}

function todayProvider(packageName) {
  return `
package ${packageName};

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
	import android.content.Context;
	import android.content.Intent;
	import android.net.Uri;
	import android.os.Bundle;
	import android.view.View;
	import android.widget.RemoteViews;

public class AmyTodayWidgetProvider extends AppWidgetProvider {
  private static final int EXPANDED_HEIGHT_DP = 132;
  private static final int NARROW_WIDTH_DP = 216;

  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    for (int appWidgetId : appWidgetIds) {
      updateOne(context, appWidgetManager, appWidgetId, appWidgetManager.getAppWidgetOptions(appWidgetId));
    }
	  }

	  @Override
	  public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
    updateOne(context, appWidgetManager, appWidgetId, newOptions);
	  }

  private void updateOne(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle options) {
    int minHeight = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
    int minWidth = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
    boolean expanded = minHeight >= EXPANDED_HEIGHT_DP;
    boolean narrow = minWidth > 0 && minWidth < NARROW_WIDTH_DP;

    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.amy_widget_today);
    views.setViewVisibility(R.id.amy_widget_prompt, expanded ? View.VISIBLE : View.GONE);
    views.setTextViewText(R.id.amy_widget_prompt, narrow ? "Log" : "Quick log");
    views.setTextViewText(R.id.amy_widget_type, narrow ? "+ Type" : "+ Type meal");
    views.setTextViewText(R.id.amy_widget_today_link, narrow ? "Day" : "Today");
      views.setOnClickPendingIntent(R.id.amy_widget_today_root, openIntent(context, "amy://today", 201));
    views.setOnClickPendingIntent(R.id.amy_widget_prompt, openIntent(context, "amy://today", 202));
    views.setOnClickPendingIntent(R.id.amy_widget_type, openIntent(context, "amy://type", 203));
    views.setOnClickPendingIntent(R.id.amy_widget_today_link, openIntent(context, "amy://today", 204));
      views.setOnClickPendingIntent(R.id.amy_widget_mic, openIntent(context, "amy://capture/mic", 205));
      views.setOnClickPendingIntent(R.id.amy_widget_camera, openIntent(context, "amy://capture/photo", 206));
      views.setOnClickPendingIntent(R.id.amy_widget_saved, openIntent(context, "amy://saved", 207));
      views.setOnClickPendingIntent(R.id.amy_widget_barcode, openIntent(context, "amy://scan/barcode", 208));
      appWidgetManager.updateAppWidget(appWidgetId, views);
  }

	  private PendingIntent openIntent(Context context, String url, int requestCode) {
    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
    intent.setPackage(context.getPackageName());
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

	}
	`;
}

function patchMainApplication(filePath) {
  if (!fs.existsSync(filePath)) return;
  let contents = fs.readFileSync(filePath, "utf8");
  if (contents.includes("AmyWidgetPackage()")) return;
  contents = contents.replace(
    "          // add(MyReactNativePackage())",
    "          // add(MyReactNativePackage())\n          add(AmyWidgetPackage())"
  );
  fs.writeFileSync(filePath, contents);
}

function withAmyAndroidWidgets(config) {
  config = withAndroidManifest(config, (config) => {
    addReceiver(config.modResults, ".AmyCaloriesWidgetProvider", "Amy Calories", "amy_calories_widget_info");
    addReceiver(config.modResults, ".AmyTodayWidgetProvider", "Amy Today", "amy_today_widget_info");
    return config;
  });

  return withDangerousMod(config, [
    "android",
    async (config) => {
      const androidRoot = config.modRequest.platformProjectRoot;
      const packageName = config.android?.package || "com.kaust.amy";
      const packagePath = packageName.replace(/\./g, "/");
      const javaRoot = path.join(androidRoot, `app/src/main/java/${packagePath}`);

	      writeFile(path.join(androidRoot, "app/src/main/res/drawable/amy_widget_background.xml"), widgetBackground);
	      writeFile(path.join(androidRoot, "app/src/main/res/drawable/amy_widget_chip.xml"), widgetChip);
	      writeFile(path.join(androidRoot, "app/src/main/res/drawable/amy_widget_primary_chip.xml"), widgetPrimaryChip);
	      writeFile(path.join(androidRoot, "app/src/main/res/drawable/amy_widget_icon_mic.xml"), widgetIconMic);
	      writeFile(path.join(androidRoot, "app/src/main/res/drawable/amy_widget_icon_camera.xml"), widgetIconCamera);
	      writeFile(path.join(androidRoot, "app/src/main/res/drawable/amy_widget_icon_plus.xml"), widgetIconPlus);
	      writeFile(path.join(androidRoot, "app/src/main/res/drawable/amy_widget_icon_barcode.xml"), widgetIconBarcode);
	      writeFile(path.join(androidRoot, "app/src/main/res/layout/amy_widget_calories.xml"), caloriesLayout);
      writeFile(path.join(androidRoot, "app/src/main/res/layout/amy_widget_today.xml"), todayLayout);
      writeFile(path.join(androidRoot, "app/src/main/res/xml/amy_calories_widget_info.xml"), caloriesInfo);
      writeFile(path.join(androidRoot, "app/src/main/res/xml/amy_today_widget_info.xml"), todayInfo);
      writeFile(path.join(javaRoot, "AmyWidgetState.java"), stateJava(packageName));
      writeFile(path.join(javaRoot, "AmyWidgetUpdater.java"), updaterJava(packageName));
      writeFile(path.join(javaRoot, "AmyWidgetModule.java"), moduleJava(packageName));
      writeFile(path.join(javaRoot, "AmyWidgetPackage.java"), packageJava(packageName));
      writeFile(path.join(javaRoot, "AmyCaloriesWidgetProvider.java"), caloriesProvider(packageName));
      writeFile(path.join(javaRoot, "AmyTodayWidgetProvider.java"), todayProvider(packageName));
      patchMainApplication(path.join(javaRoot, "MainApplication.kt"));

      return config;
    }
  ]);
}

module.exports = createRunOncePlugin(withAmyAndroidWidgets, "with-amy-android-widgets", "1.0.0");
