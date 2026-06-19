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

function addActivity(androidManifest, name, theme) {
  const application = androidManifest.manifest.application?.[0];
  if (!application) return androidManifest;

  application.activity = application.activity || [];
  const existing = application.activity.find((activity) => activity.$?.["android:name"] === name);
  if (existing) return androidManifest;

  application.activity.push({
    $: {
      "android:name": name,
      "android:exported": "false",
      "android:theme": theme
    }
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

const quickLogStyles = `
<?xml version="1.0" encoding="utf-8"?>
<resources>
  <style name="AmyQuickLogTheme" parent="@android:style/Theme.Material.NoActionBar">
    <item name="android:windowBackground">#111111</item>
    <item name="android:fontFamily">sans</item>
    <item name="android:colorAccent">#6E5BFF</item>
    <item name="android:navigationBarColor">#111111</item>
    <item name="android:windowLightStatusBar">false</item>
    <item name="android:windowLightNavigationBar">false</item>
  </style>
</resources>
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
  android:padding="18dp">
  <TextView
    android:id="@+id/amy_widget_calories_date"
    android:layout_width="72dp"
    android:layout_height="72dp"
    android:background="@drawable/amy_widget_chip"
    android:gravity="center"
    android:text="Today"
    android:textColor="#FF9824"
    android:textSize="16sp"
    android:textStyle="bold" />
  <LinearLayout
    android:layout_width="0dp"
    android:layout_height="wrap_content"
    android:layout_marginStart="14dp"
    android:layout_weight="1"
    android:orientation="vertical">
    <TextView
      android:id="@+id/amy_widget_calories_value"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:text="2,632"
      android:textColor="#FF9824"
      android:textSize="35sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/amy_widget_calories_label"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:text="calories left"
      android:textColor="#F6F6F6"
      android:textSize="16sp"
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
      android:text="C 0    P 0    F 0"
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
  android:padding="16dp">
  <TextView
    android:id="@+id/amy_widget_type"
    android:layout_width="match_parent"
    android:layout_height="0dp"
    android:layout_weight="1"
    android:gravity="top"
    android:maxLines="3"
    android:text="Start logging your meals..."
    android:textColor="#7B7B82"
    android:textSize="23sp"
    android:textStyle="bold" />
  <TextView
    android:id="@+id/amy_widget_today_macros"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginBottom="8dp"
    android:text="C 0    P 0    F 0"
    android:textColor="#FFFFFF"
    android:textSize="13sp"
    android:textStyle="bold" />
  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="54dp"
    android:gravity="center_vertical"
    android:orientation="horizontal">
    <TextView
      android:id="@+id/amy_widget_calories"
      android:layout_width="96dp"
      android:layout_height="46dp"
      android:background="@drawable/amy_widget_chip"
      android:gravity="center"
      android:text="0 cal"
      android:textColor="#FFFFFF"
      android:textSize="18sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/amy_widget_mic"
      android:layout_width="46dp"
      android:layout_height="46dp"
      android:layout_marginStart="10dp"
      android:background="@drawable/amy_widget_chip"
      android:gravity="center"
      android:text="Mic"
      android:textColor="#159BFF"
      android:textSize="13sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/amy_widget_camera"
      android:layout_width="46dp"
      android:layout_height="46dp"
      android:layout_marginStart="10dp"
      android:background="@drawable/amy_widget_chip"
      android:gravity="center"
      android:text="Cam"
      android:textColor="#F141FF"
      android:textSize="13sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/amy_widget_saved"
      android:layout_width="46dp"
      android:layout_height="46dp"
      android:layout_marginStart="10dp"
      android:background="@drawable/amy_widget_chip"
      android:gravity="center"
      android:text="+"
      android:textColor="#FF9824"
      android:textSize="28sp"
      android:textStyle="bold" />
    <TextView
      android:id="@+id/amy_widget_barcode"
      android:layout_width="46dp"
      android:layout_height="46dp"
      android:layout_marginStart="10dp"
      android:background="@drawable/amy_widget_chip"
      android:gravity="center"
      android:text="Code"
      android:textColor="#FFFFFF"
      android:textSize="12sp"
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
    return "🔥 " + format(caloriesConsumed);
  }

  public String macroLine() {
    return "C " + carbs + "    P " + protein + "    F " + fat;
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
      views.setOnClickPendingIntent(R.id.amy_widget_calories_value, openIntent(context, "amy://calories", 102));
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
      views.setOnClickPendingIntent(R.id.amy_widget_type, quickLogIntent(context, 202));
      views.setOnClickPendingIntent(R.id.amy_widget_calories, openIntent(context, "amy://calories", 203));
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

  private PendingIntent quickLogIntent(Context context, int requestCode) {
    Intent intent = new Intent(context, AmyQuickLogActivity.class);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }
}
`;
}

function quickLogActivityJava(packageName) {
  return `
package ${packageName};

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

public class AmyQuickLogActivity extends Activity {
  private EditText input;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(dp(22), dp(28), dp(22), dp(18));
    root.setBackgroundColor(Color.rgb(17, 17, 17));

    TextView title = new TextView(this);
    title.setText("Amy");
    title.setTextColor(Color.WHITE);
    title.setTextSize(30);
    title.setTypeface(null, 1);
    root.addView(title, new LinearLayout.LayoutParams(-1, -2));

    input = new EditText(this);
    input.setHint("Start logging your meals...");
    input.setHintTextColor(Color.rgb(120, 120, 128));
    input.setTextColor(Color.WHITE);
    input.setTextSize(23);
    input.setMinLines(3);
    input.setGravity(Gravity.TOP);
    input.setSingleLine(false);
    root.addView(input, new LinearLayout.LayoutParams(-1, 0, 1));

    Button logButton = button("Log typed meal");
    logButton.setOnClickListener(view -> open("amy://type?text=" + Uri.encode(input.getText().toString())));
    root.addView(logButton, new LinearLayout.LayoutParams(-1, dp(54)));

    LinearLayout row = new LinearLayout(this);
    row.setOrientation(LinearLayout.HORIZONTAL);
    row.setGravity(Gravity.CENTER);
    row.setPadding(0, dp(12), 0, 0);

    Button barcode = button("Barcode");
    barcode.setOnClickListener(view -> open("amy://scan/barcode"));
    row.addView(barcode, new LinearLayout.LayoutParams(0, dp(48), 1));

    Button camera = button("Camera");
    camera.setOnClickListener(view -> open("amy://capture/photo"));
    row.addView(camera, new LinearLayout.LayoutParams(0, dp(48), 1));

    Button saved = button("Saved");
    saved.setOnClickListener(view -> open("amy://saved"));
    row.addView(saved, new LinearLayout.LayoutParams(0, dp(48), 1));

    root.addView(row, new LinearLayout.LayoutParams(-1, -2));
    setContentView(root);

    input.requestFocus();
    input.postDelayed(() -> {
      InputMethodManager manager = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
      if (manager != null) manager.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT);
    }, 180);
  }

  private Button button(String text) {
    Button button = new Button(this);
    button.setText(text);
    button.setTextColor(Color.WHITE);
    button.setTextSize(14);
    return button;
  }

  private void open(String url) {
    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
    intent.setPackage(getPackageName());
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    startActivity(intent);
    finish();
  }

  private int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
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
    addActivity(config.modResults, ".AmyQuickLogActivity", "@style/AmyQuickLogTheme");
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
      writeFile(path.join(androidRoot, "app/src/main/res/values/amy_widget_styles.xml"), quickLogStyles);
      writeFile(path.join(androidRoot, "app/src/main/res/layout/amy_widget_calories.xml"), caloriesLayout);
      writeFile(path.join(androidRoot, "app/src/main/res/layout/amy_widget_today.xml"), todayLayout);
      writeFile(path.join(androidRoot, "app/src/main/res/xml/amy_calories_widget_info.xml"), caloriesInfo);
      writeFile(path.join(androidRoot, "app/src/main/res/xml/amy_today_widget_info.xml"), todayInfo);
      writeFile(path.join(javaRoot, "AmyWidgetState.java"), stateJava(packageName));
      writeFile(path.join(javaRoot, "AmyWidgetUpdater.java"), updaterJava(packageName));
      writeFile(path.join(javaRoot, "AmyWidgetModule.java"), moduleJava(packageName));
      writeFile(path.join(javaRoot, "AmyWidgetPackage.java"), packageJava(packageName));
      writeFile(path.join(javaRoot, "AmyQuickLogActivity.java"), quickLogActivityJava(packageName));
      writeFile(path.join(javaRoot, "AmyCaloriesWidgetProvider.java"), caloriesProvider(packageName));
      writeFile(path.join(javaRoot, "AmyTodayWidgetProvider.java"), todayProvider(packageName));
      patchMainApplication(path.join(javaRoot, "MainApplication.kt"));

      return config;
    }
  ]);
}

module.exports = createRunOncePlugin(withAmyAndroidWidgets, "with-amy-android-widgets", "1.0.0");
