import { BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Camera, Circle, Flashlight, Image as ImageIcon, Keyboard, Mic, ScanBarcode, Tags } from "lucide-react-native";

import { InteractivePressable } from "../components/InteractivePressable";
import { lookupOpenFoodFactsProduct } from "../services/openFoodFacts";
import { estimateMealImage } from "../services/openRouter";
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
  const { data, selectedDay, addEntryFromDraft, appendDayNoteLine } = useAppData();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [caption, setCaption] = useState("");
  const [notice, setNotice] = useState("");
  const [torchOn, setTorchOn] = useState(false);
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
      addEntryFromDraft(result.draft, result.draft.title);
      appendDayNoteLine(selectedDay, result.draft.title);
      setNotice("Open Food Facts logged.");
      onDone();
    } else {
      setNotice(result.detail ? `${result.message}\n${result.detail}` : result.message);
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

  const analyzeImageUri = async (imageUri: string) => {
    try {
      setBusy(true);
      const note = caption.trim();
      const estimate = await estimateMealImage({
        imageUri,
        day: selectedDay,
        mode: mode === "label" ? "label" : "photo",
        caption: note,
        context: {
          openRouterKey: data?.settings.openRouterKey,
          openRouterModel: data?.settings.openRouterModel
        }
      });
      estimate.drafts.forEach((draft) => {
        const rawInput = note || draft.rawInput || draft.title;
        addEntryFromDraft(draft, rawInput);
        appendDayNoteLine(selectedDay, rawInput);
      });
      setNotice(estimate.error ?? estimate.notice ?? "Image logged.");
      onDone();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not analyze this image.");
    } finally {
      setBusy(false);
    }
  };

  const captureImage = async () => {
    if (busy) return;
    if (!cameraRef.current) {
      setNotice("Camera is not ready yet.");
      return;
    }
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.82 });
    if (!photo?.uri) {
      setNotice("No image was captured.");
      return;
    }
    await analyzeImageUri(photo.uri);
  };

  const pickImage = async () => {
    if (busy) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNotice("Gallery permission is needed to choose a food photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.82,
      allowsEditing: false
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.uri) await analyzeImageUri(asset.uri);
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
        <View style={styles.modeIcon}>
          {mode === "barcode" ? <ScanBarcode size={28} color={colors.orange} /> : mode === "label" ? <Tags size={28} color={colors.pink} /> : <Camera size={28} color="#F141FF" />}
        </View>
        <View style={styles.modeText}>
          <Text style={styles.hero}>{mode === "barcode" ? "Scan barcode" : mode === "label" ? "Capture label" : "Capture meal"}</Text>
          <Text style={styles.copy}>
            {mode === "barcode" ? "Point at the code or type the number below." : "Use a photo plus a note for better Gemini 3.5 estimates."}
          </Text>
        </View>
      </View>

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
              enableTorch={torchOn}
              barcodeScannerSettings={mode === "barcode" ? { barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"] } : undefined}
              onBarcodeScanned={mode === "barcode" && !busy ? handleBarcode : undefined}
            />
            <View style={styles.cameraScrim} pointerEvents="none" />
            {mode === "barcode" ? <View style={styles.scanFrame} pointerEvents="none" /> : null}
            <View style={styles.overlayTop}>
              <InteractivePressable
                accessibilityLabel={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
                onPress={() => setTorchOn((value) => !value)}
                style={[styles.overlayButton, torchOn && styles.overlayButtonOn]}
              >
                <Flashlight size={21} color={torchOn ? colors.bg : colors.ink} strokeWidth={2.5} />
              </InteractivePressable>
              {mode !== "barcode" ? (
                <InteractivePressable accessibilityLabel="Choose from gallery" onPress={pickImage} style={styles.overlayButton}>
                  <ImageIcon size={21} color={colors.ink} strokeWidth={2.5} />
                </InteractivePressable>
              ) : null}
            </View>
            {mode !== "barcode" ? (
              <View style={styles.overlayBottom}>
                <InteractivePressable accessibilityLabel="Capture food photo" onPress={captureImage} disabled={busy} style={styles.captureButton}>
                  {busy ? <ActivityIndicator color={colors.ink} /> : <Circle size={34} color={colors.ink} fill={colors.ink} strokeWidth={2.2} />}
                </InteractivePressable>
              </View>
            ) : (
              <View style={styles.barcodeHint} pointerEvents="none">
                <ScanBarcode size={24} color={colors.ink} />
                <Text style={styles.barcodeHintText}>Align barcode inside the frame</Text>
              </View>
            )}
          </View>
        )
      ) : (
        <Text style={styles.notice}>Camera preview is Android-first. Use manual barcode or typing in web preview.</Text>
      )}

      {mode === "barcode" ? (
        <View style={styles.manualCard}>
          <TextInput
            value={manualBarcode}
            onChangeText={(value) => setManualBarcode(value.replace(/\D/g, ""))}
            keyboardType="number-pad"
            inputMode="numeric"
            returnKeyType="search"
            onSubmitEditing={() => lookupBarcode(manualBarcode)}
            placeholder="Type barcode number"
            placeholderTextColor={colors.dim}
            style={styles.input}
          />
          <InteractivePressable onPress={() => lookupBarcode(manualBarcode)} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>{busy ? "Checking..." : "Check Open Food Facts"}</Text>
          </InteractivePressable>
        </View>
      ) : (
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={mode === "label" ? "Typed note for the label photo" : "Typed note for the food photo"}
          placeholderTextColor={colors.dim}
          style={styles.input}
        />
      )}

      {busy ? <ActivityIndicator color={colors.purple} /> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
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
    paddingHorizontal: 2
  },
  modeIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
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
    padding: 14,
    borderRadius: 22,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
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
    minHeight: 420,
    borderRadius: 26,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    position: "relative"
  },
  camera: {
    height: 420
  },
  cameraScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.08)"
  },
  overlayTop: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    gap: 10
  },
  overlayButton: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17, 17, 17, 0.74)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)"
  },
  overlayButtonOn: {
    backgroundColor: colors.yellow,
    borderColor: colors.yellow
  },
  overlayBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 18,
    alignItems: "center"
  },
  captureButton: {
    width: 74,
    height: 74,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.24)",
    borderWidth: 4,
    borderColor: colors.ink
  },
  scanFrame: {
    position: "absolute",
    left: 34,
    right: 34,
    top: 132,
    height: 136,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.orange,
    backgroundColor: "rgba(255, 152, 36, 0.08)"
  },
  barcodeHint: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    minHeight: 54,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(17, 17, 17, 0.76)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)"
  },
  barcodeHintText: {
    color: colors.ink,
    fontSize: 14,
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
