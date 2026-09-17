import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Barcode, Camera, Tags } from "lucide-react-native";

import { ModalShell } from "./src/components/ModalShell";
import { ErrorBoundary, RecoveryScreen } from "./src/components/RecoveryScreen";
import { ToastProvider } from "./src/components/Toast";
import { sanitizePrefill } from "./src/domain/lines";
import { LocalDataProvider, useAppData } from "./src/store/AppDataContext";
import { colors } from "./src/theme";
import { CaptureModal } from "./src/screens/CaptureModal";
import { currentStreakDays } from "./src/domain/streaks";
import { CaptureMode, AppModal, TodayScreen } from "./src/screens/TodayScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { SavedMealsModal } from "./src/screens/SavedMealsModal";
import { SettingsModal } from "./src/screens/SettingsModal";
import { StatsModal, StatsTabs, StatsTab } from "./src/screens/StatsModal";

function routeFromUrl(
  url: string
): { modal: AppModal; captureMode?: CaptureMode; focusType?: boolean; startDictation?: boolean; prefillText?: string; barcode?: string } | null {
  let clean = "";
  let prefillText: string | undefined;
  let barcode: string | undefined;
  try {
    const parsed = new URL(url);
    clean = `${parsed.hostname}${parsed.pathname}`.replace(/^\/+/, "");
    // Links can come from any app or web page, so their payloads are only ever prefilled:
    // text is collapsed to one unsent line and barcodes stop at a confirmation card.
    prefillText = sanitizePrefill(parsed.searchParams.get("text")) || undefined;
    barcode = (parsed.searchParams.get("code") ?? parsed.searchParams.get("barcode") ?? "").replace(/\D/g, "").slice(0, 14) || undefined;
  } catch {
    clean = url
      .replace(/^amy:\/\//i, "")
      .replace(/^https?:\/\/[^/]+\//i, "")
      .replace(/^\/+/, "");
  }

  if (!clean || clean.startsWith("today")) return { modal: null };
  if (clean.startsWith("type") || clean.startsWith("capture/type")) return { modal: null, focusType: true, prefillText };
  if (clean.includes("barcode")) return { modal: "capture", captureMode: "barcode", barcode };
  if (clean.includes("photo") || clean.includes("camera")) return { modal: "capture", captureMode: "photo" };
  if (clean.includes("label")) return { modal: "capture", captureMode: "label" };
  if (clean.includes("mic") || clean.includes("dictation")) return { modal: null, focusType: true, startDictation: true };
  if (clean.includes("saved")) return { modal: "saved" };
  if (clean.includes("stats")) return { modal: "stats" };
  if (clean.includes("settings")) return { modal: "settings" };
  if (clean.includes("calories")) return { modal: null };

  return null;
}

function AppBody() {
  const { ready, data, today, loadError, retryLoad, startFresh } = useAppData();
  const [activeModal, setActiveModal] = useState<AppModal>(null);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("photo");
  const [statsTab, setStatsTab] = useState<StatsTab>("stats");
  const [focusSignal, setFocusSignal] = useState(0);
  const [dictationSignal, setDictationSignal] = useState(0);
  const [prefillText, setPrefillText] = useState("");
  const [prefillBarcode, setPrefillBarcode] = useState("");
  const captureTitle = captureMode === "barcode" ? "Scan barcode" : captureMode === "label" ? "Label agent" : "Food agent";
  const captureTitleIcon =
    captureMode === "barcode" ? (
      <Barcode size={28} color={colors.orange} strokeWidth={2.5} />
    ) : captureMode === "label" ? (
      <Tags size={28} color={colors.pink} strokeWidth={2.5} />
    ) : (
      <Camera size={28} color={colors.pink} strokeWidth={2.5} />
    );
  const statsStreakCount = data ? currentStreakDays(data.entries, today) : 0;

  const focusTypeInput = useCallback((text?: string) => {
    setPrefillText(text ?? "");
    setActiveModal(null);
    setFocusSignal((value) => value + 1);
  }, []);

  const openModal = useCallback((modal: AppModal, nextCaptureMode?: CaptureMode) => {
    if (nextCaptureMode) setCaptureMode(nextCaptureMode);
    setActiveModal(modal);
  }, []);

  const handleUrl = useCallback(
    (url: string | null) => {
      if (!url) return;
      const route = routeFromUrl(url);
      if (!route) return;
      if (route.captureMode) setCaptureMode(route.captureMode);
      setPrefillBarcode(route.barcode ?? "");
      setActiveModal(route.modal);
      if (route.focusType) focusTypeInput(route.prefillText);
      if (route.startDictation) setDictationSignal((value) => value + 1);
    },
    [focusTypeInput]
  );

  useEffect(() => {
    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener("url", (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, [handleUrl]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.purple} size="large" />
        <Text style={styles.loadingText}>Loading Amy</Text>
      </View>
    );
  }

  if (loadError || !data) {
    return (
      <RecoveryScreen
        title="Amy could not open your diary"
        detail={`${loadError ?? "Saved data is unavailable."}\n\nNothing has been deleted. Try again first. If it keeps failing, copy your raw data somewhere safe before starting fresh.`}
        onRetry={retryLoad}
        onStartFresh={startFresh}
      />
    );
  }

  if (!data.settings.onboardingDone) return <OnboardingScreen />;

  return (
    <View style={styles.shell}>
      <TodayScreen openModal={openModal} focusSignal={focusSignal} dictationSignal={dictationSignal} prefillText={prefillText} />

      <ModalShell visible={activeModal === "saved"} title="Saved Meals" onClose={() => setActiveModal(null)}>
        <SavedMealsModal onDone={() => setActiveModal(null)} />
      </ModalShell>
      <ModalShell
        visible={activeModal === "stats"}
        headerContent={<StatsTabs tab={statsTab} onTabChange={setStatsTab} streakCount={statsStreakCount} />}
        onClose={() => setActiveModal(null)}
      >
        <StatsModal tab={statsTab} />
      </ModalShell>
      <ModalShell visible={activeModal === "settings"} title="Settings" onClose={() => setActiveModal(null)}>
        <SettingsModal />
      </ModalShell>
      <ModalShell visible={activeModal === "capture"} title={captureTitle} titleIcon={captureTitleIcon} onClose={() => setActiveModal(null)}>
        <CaptureModal
          mode={captureMode}
          onDone={() => setActiveModal(null)}
          focusTypeInput={() => focusTypeInput()}
          openSettings={() => setActiveModal("settings")}
          prefillBarcode={prefillBarcode}
        />
      </ModalShell>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} translucent={false} />
      <ErrorBoundary>
        <LocalDataProvider>
          <ToastProvider>
            <AppBody />
          </ToastProvider>
        </LocalDataProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.bg
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.bg
  },
  loadingText: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: "900"
  }
});
