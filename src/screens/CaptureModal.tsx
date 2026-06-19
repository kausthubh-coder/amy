import { BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Camera, Keyboard, Mic, ScanBarcode, Tags } from "lucide-react-native";

import { InteractivePressable } from "../components/InteractivePressable";
import { lookupOpenFoodFactsProduct } from "../services/openFoodFacts";
import { estimateMealImage, estimateMealText } from "../services/openRouter";
import { useAppData } from "../store/AppDataContext";
import { colors } from "../theme";
import { CaptureMode } from "./TodayScreen";

export function CaptureModal({
  mode,
  onDone,
  focusTypeInput,
  prefillBarcode
}: {
  mode: CaptureMode;
  onDone: () => void;
  focusTypeInput: () => void;
  prefillBarcode?: string;
}) {
  const { selectedDay, addDrafts } = useAppData();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [caption, setCaption] = useState("");
  const [notice, setNotice] = useState("");
  const cameraRef = useRef<CameraView | null>(null);
  const lastPrefillLookupRef = useRef("");

  const needsCamera = mode === "barcode" || mode === "photo" || mode === "label";
  const canUseCamera = Platform.OS !== "web" && needsCamera;

  const lookupBarcode = async (code: string) => {
    if (busy) return;
    const cleanCode = code.replace(/\D/g, "");
    if (!cleanCode) {
      setNotice("Enter a barcode first.");
      return;
    }
    setBusy(true);
    const result = await lookupOpenFoodFactsProduct(cleanCode, selectedDay);
    if (result.status === "found") {
      addDrafts([result.draft]);
      setNotice("Open Food Facts match ready. Confirm it on Today.");
      onDone();
    } else {
      setNotice(result.message);
    }
    setBusy(false);
  };

  useEffect(() => {
    const cleanCode = prefillBarcode?.replace(/\D/g, "") ?? "";
    if (mode !== "barcode" || !cleanCode || lastPrefillLookupRef.current === cleanCode) return;
    lastPrefillLookupRef.current = cleanCode;
    setManualBarcode(cleanCode);
    void lookupBarcode(cleanCode);
  }, [mode, prefillBarcode]);

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (!result.data || busy) return;
    void lookupBarcode(result.data);
  };

  const captureImage = async () => {
    if (busy) return;
    if (!cameraRef.current) {
      setNotice("Camera is not ready yet.");
      return;
    }
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.75 });
      if (!photo?.uri) throw new Error("No image was captured.");
      const estimate = await estimateMealImage({ imageUri: photo.uri, day: selectedDay, mode: mode === "label" ? "label" : "photo", caption });
      addDrafts(estimate.drafts);
      setNotice(estimate.error ?? estimate.notice ?? "Image estimate ready.");
      onDone();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not analyze this image.");
    } finally {
      setBusy(false);
    }
  };

  const analyzeTyped = async () => {
    const prompt = caption.trim();
    if (!prompt) {
      focusTypeInput();
      onDone();
      return;
    }
    setBusy(true);
    const estimate = await estimateMealText(prompt, selectedDay);
    addDrafts(estimate.drafts);
    setNotice(estimate.error ?? estimate.notice ?? "Estimate ready.");
    setBusy(false);
    onDone();
  };

  if (mode === "type") {
    return (
      <View style={styles.stack}>
        <Text style={styles.hero}>Ready to type a meal.</Text>
        <InteractivePressable
          feedbackKind="success"
          onPress={() => {
            focusTypeInput();
            onDone();
          }}
          style={styles.primaryButton}
        >
          <Keyboard size={22} color={colors.ink} />
          <Text style={styles.primaryText}>Open typing</Text>
        </InteractivePressable>
      </View>
    );
  }

  if (mode === "mic") {
    return (
      <View style={styles.stack}>
        <Text style={styles.hero}>Ready for dictation.</Text>
        <InteractivePressable
          feedbackKind="success"
          onPress={() => {
            focusTypeInput();
            onDone();
          }}
          style={styles.primaryButton}
        >
          <Mic size={22} color={colors.ink} />
          <Text style={styles.primaryText}>Go to mic</Text>
        </InteractivePressable>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.modeHeader}>
        {mode === "barcode" ? <ScanBarcode size={30} color={colors.orange} /> : mode === "label" ? <Tags size={30} color={colors.pink} /> : <Camera size={30} color="#F141FF" />}
        <View style={styles.modeText}>
          <Text style={styles.hero}>{mode === "barcode" ? "Scan barcode" : mode === "label" ? "Capture label" : "Capture meal"}</Text>
          <Text style={styles.copy}>{mode === "barcode" ? "Scan packaged foods." : "Photos become editable drafts."}</Text>
        </View>
      </View>

      {mode === "barcode" ? (
        <View style={styles.manualCard}>
          <TextInput
            value={manualBarcode}
            onChangeText={(value) => setManualBarcode(value.replace(/\D/g, ""))}
            keyboardType="number-pad"
            inputMode="numeric"
            returnKeyType="search"
            onSubmitEditing={() => lookupBarcode(manualBarcode)}
            placeholder="Enter barcode"
            placeholderTextColor={colors.dim}
            style={styles.input}
          />
          <InteractivePressable onPress={() => lookupBarcode(manualBarcode)} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Lookup barcode</Text>
          </InteractivePressable>
        </View>
      ) : (
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={mode === "label" ? "Optional label note" : "Optional photo note"}
          placeholderTextColor={colors.dim}
          style={styles.input}
        />
      )}

      {canUseCamera ? (
        !permission?.granted ? (
          <InteractivePressable onPress={requestPermission} style={styles.primaryButton}>
            <Camera size={22} color={colors.ink} />
            <Text style={styles.primaryText}>Allow camera</Text>
          </InteractivePressable>
        ) : (
          <View style={styles.cameraCard}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
              onBarcodeScanned={mode === "barcode" && !busy ? handleBarcode : undefined}
            />
            {mode !== "barcode" ? (
              <InteractivePressable onPress={captureImage} disabled={busy} style={styles.shutter}>
                {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.shutterText}>Capture</Text>}
              </InteractivePressable>
            ) : null}
          </View>
        )
      ) : (
        <Text style={styles.notice}>Camera preview is Android-first. Use manual barcode or typing in web preview.</Text>
      )}

      {busy ? <ActivityIndicator color={colors.purple} /> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {mode !== "barcode" ? (
        <InteractivePressable onPress={analyzeTyped} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Estimate from typed note instead</Text>
        </InteractivePressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16
  },
  modeHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 18,
    borderRadius: 28,
    backgroundColor: colors.panel
  },
  modeText: {
    flex: 1
  },
  hero: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "900"
  },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700"
  },
  manualCard: {
    gap: 10,
    padding: 16,
    borderRadius: 24,
    backgroundColor: colors.panel
  },
  input: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: colors.panel2,
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    paddingHorizontal: 14
  },
  primaryButton: {
    height: 58,
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.purple
  },
  primaryText: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel2,
    paddingHorizontal: 18
  },
  secondaryText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  cameraCard: {
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  camera: {
    height: 370
  },
  shutter: {
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.orange
  },
  shutterText: {
    color: colors.bg,
    fontSize: 18,
    fontWeight: "900"
  },
  notice: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    textAlign: "center"
  }
});
