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
      android:text="2,632"
      android:textColor="#FF9824"
      android:textSize="29sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/amy_widget_calories_label"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:text="calories left"
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
  android:orientation="vertical"
  android:padding="14dp">
  <TextView
    android:id="@+id/amy_widget_type"
    android:layout_width="match_parent"
    android:layout_height="0dp"
    android:layout_weight="1"
    android:gravity="top"
    android:maxLines="3"
    android:text="Start logging your meals..."
    android:textColor="#7B7B82"
    android:textSize="21sp"
    android:textStyle="bold" />
  <TextView
    android:id="@+id/amy_widget_today_macros"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginBottom="8dp"
    android:text="C0  P0  F0"
    android:textColor="#FFFFFF"
    android:textSize="12sp"
    android:textStyle="bold" />
  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="48dp"
    android:gravity="center_vertical"
    android:orientation="horizontal">
    <TextView
      android:id="@+id/amy_widget_calories"
      android:layout_width="76dp"
      android:layout_height="42dp"
      android:background="@drawable/amy_widget_chip"
      android:gravity="center"
      android:text="0 cal"
      android:textColor="#FFFFFF"
      android:textSize="15sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/amy_widget_mic"
      android:layout_width="42dp"
      android:layout_height="42dp"
      android:layout_marginStart="8dp"
      android:background="@drawable/amy_widget_chip"
      android:gravity="center"
      android:text="🎙"
      android:textColor="#159BFF"
      android:textSize="19sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/amy_widget_camera"
      android:layout_width="42dp"
      android:layout_height="42dp"
      android:layout_marginStart="8dp"
      android:background="@drawable/amy_widget_chip"
      android:gravity="center"
      android:text="📷"
      android:textColor="#F141FF"
      android:textSize="19sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/amy_widget_saved"
      android:layout_width="42dp"
      android:layout_height="42dp"
      android:layout_marginStart="8dp"
      android:background="@drawable/amy_widget_chip"
      android:gravity="center"
      android:text="+"
      android:textColor="#FF9824"
      android:textSize="26sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/amy_widget_barcode"
      android:layout_width="42dp"
      android:layout_height="42dp"
      android:layout_marginStart="8dp"
      android:background="@drawable/amy_widget_chip"
      android:gravity="center"
      android:text="▦"
      android:textColor="#FFFFFF"
      android:textSize="22sp"
      android:textStyle="bold" />
  </LinearLayout>
</LinearLayout>
`;

const caloriesInfo = `
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/app_name"
  android:initialLayout="@layout/amy_widget_calories"
  android:minWidth="250dp"
  android:minHeight="110dp"
  android:previewLayout="@layout/amy_widget_calories"
  android:resizeMode="horizontal|vertical"
  android:updatePeriodMillis="0"
  android:widgetCategory="home_screen" />
`;

const todayInfo = `
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:description="@string/app_name"
  android:initialLayout="@layout/amy_widget_today"
  android:minWidth="320dp"
  android:minHeight="150dp"
  android:previewLayout="@layout/amy_widget_today"
  android:resizeMode="horizontal|vertical"
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
  public String note = "";
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
      state.note = object.optString("note", state.note);
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

  public String noteText() {
    String clean = note == null ? "" : note.trim();
    return clean.length() > 0 ? clean : "Start logging your meals...";
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
import android.widget.RemoteViews;

public class AmyCaloriesWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    AmyWidgetState state = AmyWidgetState.read(context);
    for (int appWidgetId : appWidgetIds) {
      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.amy_widget_calories);
      views.setTextViewText(R.id.amy_widget_calories_value, state.remainingLabel());
      views.setTextViewText(R.id.amy_widget_calories_label, "calories left");
      views.setTextViewText(R.id.amy_widget_calories_macro, state.macroLine());
      views.setTextViewText(R.id.amy_widget_calories_date, state.dayLabel);
      views.setOnClickPendingIntent(R.id.amy_widget_calories_root, openIntent(context, "amy://today", 101));
	      views.setOnClickPendingIntent(R.id.amy_widget_calories_value, openIntent(context, "amy://today", 102));
      appWidgetManager.updateAppWidget(appWidgetId, views);
    }
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
import android.widget.RemoteViews;

public class AmyTodayWidgetProvider extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
    AmyWidgetState state = AmyWidgetState.read(context);
    for (int appWidgetId : appWidgetIds) {
      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.amy_widget_today);
      views.setTextViewText(R.id.amy_widget_type, state.noteText());
      views.setTextViewText(R.id.amy_widget_calories, state.consumedLabel());
      views.setTextViewText(R.id.amy_widget_today_macros, state.macroLine());
      views.setOnClickPendingIntent(R.id.amy_widget_today_root, openIntent(context, "amy://today", 201));
	      views.setOnClickPendingIntent(R.id.amy_widget_type, openIntent(context, "amy://type", 202));
	      views.setOnClickPendingIntent(R.id.amy_widget_calories, openIntent(context, "amy://today", 203));
      views.setOnClickPendingIntent(R.id.amy_widget_mic, openIntent(context, "amy://capture/mic", 204));
      views.setOnClickPendingIntent(R.id.amy_widget_camera, openIntent(context, "amy://capture/photo", 205));
      views.setOnClickPendingIntent(R.id.amy_widget_saved, openIntent(context, "amy://saved", 206));
      views.setOnClickPendingIntent(R.id.amy_widget_barcode, openIntent(context, "amy://scan/barcode", 207));
      appWidgetManager.updateAppWidget(appWidgetId, views);
    }
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
