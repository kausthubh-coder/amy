import { BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Barcode, Camera, Flashlight, Image as ImageIcon, Keyboard, Mic, Plus, Sparkles, X } from "lucide-react-native";

import { InteractivePressable } from "../components/InteractivePressable";
import { createId } from "../domain/seed";
import { FoodDraft, MacroTotals } from "../domain/types";
import { getLocationContext } from "../services/location";
import { lookupOpenFoodFactsProduct } from "../services/openFoodFacts";
import { estimateMealImage, ImageEstimateInput } from "../services/openRouter";
import { useAppData } from "../store/AppDataContext";
import { colors } from "../theme";
import { CaptureMode } from "./TodayScreen";

type AgentImage = ImageEstimateInput & {
  id: string;
};

function cleanTitle(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function uniqueTitles(drafts: FoodDraft[]) {
  const seen = new Set<string>();
  return drafts
    .map((draft) => cleanTitle(draft.title))
    .filter((title) => {
      const key = title.toLowerCase();
      if (!title || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function readableList(titles: string[]) {
  if (!titles.length) return "";
  if (titles.length === 1) return titles[0]!;
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
  return `${titles.slice(0, 2).join(", ")} and ${titles.length - 2} more`;
}

function sumMacros(drafts: FoodDraft[]): MacroTotals {
  return drafts.reduce(
    (total, draft) => ({
      calories: total.calories + draft.macros.calories,
      carbs: Math.round((total.carbs + draft.macros.carbs) * 10) / 10,
      protein: Math.round((total.protein + draft.macros.protein) * 10) / 10,
      fat: Math.round((total.fat + draft.macros.fat) * 10) / 10
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 }
  );
}

function averageConfidence(drafts: FoodDraft[]) {
  if (!drafts.length) return 0.55;
  return drafts.reduce((sum, draft) => sum + draft.confidence, 0) / drafts.length;
}

function imageLogLine(drafts: FoodDraft[], note: string, mode: "photo" | "label") {
  const cleanNote = cleanTitle(note);
  if (cleanNote) return cleanNote;
  return readableList(uniqueTitles(drafts)) || (mode === "label" ? "Nutrition label photo" : "Meal photo");
}

function imageEntryDraft(drafts: FoodDraft[], line: string, imageUri: string, day: string, mode: "photo" | "label"): FoodDraft {
  const titles = uniqueTitles(drafts);
  const title = readableList(titles) || line;
  const source = drafts[0]?.source ?? (mode === "label" ? "label_ocr" : "ai_photo");

  if (drafts.length === 1) {
    const draft = drafts[0]!;
    return {
      ...draft,
      rawInput: line,
      title: cleanTitle(draft.title) || title,
      imageUri
    };
  }

  return {
    id: createId("draft_image"),
    day,
    rawInput: line,
    title,
    servingLabel: `${drafts.length || 1} photo items`,
    macros: sumMacros(drafts),
    source,
    confidence: averageConfidence(drafts),
    sourceLabel: drafts[0]?.sourceLabel ?? (mode === "label" ? "Label estimate" : "Amy estimate"),
    imageUri,
    createdAt: new Date().toISOString()
  };
}

function imageDataUrlFromBase64(base64?: string | null, mimeType?: string | null) {
  if (!base64) return undefined;
  const safeMimeType = mimeType === "image/png" || mimeType === "image/webp" ? mimeType : "image/jpeg";
  return `data:${safeMimeType};base64,${base64}`;
}

function imageFromAsset(asset: ImagePicker.ImagePickerAsset | undefined): AgentImage | undefined {
  if (!asset?.uri) return undefined;
  return {
    id: createId("agent_image"),
    uri: asset.uri,
    dataUrl: imageDataUrlFromBase64(asset.base64, asset.mimeType)
  };
}

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
  const { data, selectedDay, addEntryFromDraft } = useAppData();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState("");
  const [notice, setNotice] = useState("");
  const [agentImages, setAgentImages] = useState<AgentImage[]>([]);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
  const lastPrefillLookupRef = useRef("");
  const barcodeLookupInFlightRef = useRef(false);
  const { height } = useWindowDimensions();

  const needsCamera = mode === "barcode";
  const canUseCamera = Platform.OS !== "web" && needsCamera;
  const cameraHeight = Math.round(Math.max(356, Math.min(430, height * 0.54)));

  useEffect(() => {
    setCameraReady(false);
    setCaption("");
    setAgentImages([]);
    setNotice("");
  }, [mode]);

  const lookupBarcode = async (code: string) => {
    if (barcodeLookupInFlightRef.current) return;
    const cleanCode = code.replace(/\D/g, "");
    if (!cleanCode) {
      setNotice("Aim the camera at a package barcode.");
      return;
    }
    barcodeLookupInFlightRef.current = true;
    setBusy(true);
    try {
      const result = await lookupOpenFoodFactsProduct(cleanCode, selectedDay);
      if (result.status === "found") {
        addEntryFromDraft(result.draft, result.draft.title, { allowDuplicateNoteLine: true });
        setNotice("Open Food Facts logged.");
        onDone();
      } else {
        setNotice(result.detail ? `${result.message}\n${result.detail}` : result.message);
      }
    } finally {
      barcodeLookupInFlightRef.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    const cleanCode = prefillBarcode?.replace(/\D/g, "") ?? "";
    if (mode !== "barcode" || !cleanCode || lastPrefillLookupRef.current === cleanCode) return;
    lastPrefillLookupRef.current = cleanCode;
    void lookupBarcode(cleanCode);
  }, [mode, prefillBarcode]);

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (!result.data || busy) return;
    void lookupBarcode(result.data);
  };

  const addAgentImages = (images: AgentImage[]) => {
    if (!images.length) return;
    setNotice("");
    setAgentImages((current) => [...current, ...images].slice(0, 6));
  };

  const pickAgentImages = async () => {
    if (busy) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setNotice("Gallery permission is needed to choose food photos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.72,
        base64: true,
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: 6
      });
      if (result.canceled) return;
      addAgentImages(result.assets.map(imageFromAsset).filter((image): image is AgentImage => Boolean(image)));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not choose these images.");
    }
  };

  const takeAgentPhoto = async () => {
    if (busy) return;
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setNotice("Camera permission is needed to take a food photo.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.72,
        base64: true,
        allowsEditing: false
      });
      if (result.canceled) return;
      const image = imageFromAsset(result.assets?.[0]);
      if (image) addAgentImages([image]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not take this photo.");
    }
  };

  const removeAgentImage = (imageId: string) => {
    setAgentImages((current) => current.filter((image) => image.id !== imageId));
  };

  const submitImageAgent = async () => {
    if (busy) return;
    if (!agentImages.length) {
      setNotice("Add at least one food photo first.");
      return;
    }
    try {
      setBusy(true);
      setNotice("Running food agent...");
      const note = caption.trim();
      const locationContext = data?.settings.locationForRestaurants ? await getLocationContext() : {};
      const estimate = await estimateMealImage({
        images: agentImages,
        day: selectedDay,
        mode: mode === "label" ? "label" : "photo",
        caption: note,
        context: {
          calorieBias: data?.settings.calorieBias,
          locationLabel: locationContext.label,
          openRouterKey: data?.settings.openRouterKey,
          openRouterModel: data?.settings.openRouterModel
        }
      });
      if (!estimate.drafts.length) {
        setNotice(estimate.error ?? estimate.notice ?? locationContext.error ?? "Could not analyze this image.");
        return;
      }
      const line = imageLogLine(estimate.drafts, note, mode === "label" ? "label" : "photo");
      const draft = imageEntryDraft(estimate.drafts, line, agentImages[0]?.uri ?? "", selectedDay, mode === "label" ? "label" : "photo");
      addEntryFromDraft(draft, line, { allowDuplicateNoteLine: true });
      setNotice(locationContext.error ?? estimate.error ?? estimate.notice ?? "Food logged.");
      onDone();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not run the food agent.");
    } finally {
      setBusy(false);
    }
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

  if (mode === "photo" || mode === "label") {
    const agentTitle = mode === "label" ? "Label agent" : "Food agent";
    const submitDisabled = busy || agentImages.length === 0;

    return (
      <View style={styles.stack}>
        <View style={styles.agentHeader}>
          <View style={styles.agentIcon}>
            <Sparkles size={24} color={colors.ink} strokeWidth={2.5} />
          </View>
          <View style={styles.agentHeaderText}>
            <Text style={styles.agentTitle}>{agentTitle}</Text>
            <Text style={styles.agentMeta}>{agentImages.length ? `${agentImages.length} photo${agentImages.length === 1 ? "" : "s"}` : "No photos"}</Text>
          </View>
        </View>

        <View style={styles.agentActions}>
          <InteractivePressable onPress={takeAgentPhoto} disabled={busy} style={styles.agentActionButton}>
            <Camera size={22} color={colors.ink} strokeWidth={2.5} />
            <Text style={styles.agentActionText}>Camera</Text>
          </InteractivePressable>
          <InteractivePressable onPress={pickAgentImages} disabled={busy} style={styles.agentActionButton}>
            <ImageIcon size={22} color={colors.ink} strokeWidth={2.5} />
            <Text style={styles.agentActionText}>Photos</Text>
          </InteractivePressable>
        </View>

        {agentImages.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRow}>
            {agentImages.map((image, index) => (
              <View key={image.id} style={styles.thumbnailCard}>
                <Image source={{ uri: image.uri }} style={styles.thumbnailImage} />
                <Text style={styles.thumbnailIndex}>{index + 1}</Text>
                <InteractivePressable
                  accessibilityLabel="Remove photo"
                  onPress={() => removeAgentImage(image.id)}
                  disabled={busy}
                  style={styles.removeThumbnail}
                >
                  <X size={18} color={colors.ink} strokeWidth={2.6} />
                </InteractivePressable>
              </View>
            ))}
            {agentImages.length < 6 ? (
              <InteractivePressable onPress={pickAgentImages} disabled={busy} style={styles.addMoreCard}>
                <Plus size={24} color={colors.ink} strokeWidth={2.6} />
              </InteractivePressable>
            ) : null}
          </ScrollView>
        ) : (
          <InteractivePressable onPress={pickAgentImages} disabled={busy} style={styles.emptyDropZone}>
            <ImageIcon size={30} color={colors.dim} strokeWidth={2.5} />
            <Text style={styles.emptyDropText}>Add photos</Text>
          </InteractivePressable>
        )}

        <TextInput
          value={caption}
          onChangeText={setCaption}
          multiline
          placeholder={mode === "label" ? "Optional prompt or serving detail" : "Optional prompt"}
          placeholderTextColor={colors.dim}
          style={styles.promptInput}
        />

        <InteractivePressable
          feedbackKind="success"
          onPress={submitImageAgent}
          disabled={submitDisabled}
          style={[styles.submitButton, submitDisabled && styles.disabledButton]}
        >
          {busy ? <ActivityIndicator color={colors.ink} /> : <Sparkles size={22} color={colors.ink} strokeWidth={2.6} />}
          <Text style={styles.submitText}>{busy ? "Running..." : "Submit"}</Text>
        </InteractivePressable>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <Text style={styles.copy}>Point at the code and hold steady inside the frame.</Text>

      {canUseCamera ? (
        !permission?.granted ? (
          <InteractivePressable onPress={requestPermission} style={styles.primaryButton}>
            <Camera size={22} color={colors.ink} />
            <Text style={styles.primaryText}>Allow camera</Text>
          </InteractivePressable>
        ) : (
          <View style={[styles.cameraCard, { minHeight: cameraHeight }]}>
            <CameraView
              ref={cameraRef}
              style={[styles.camera, { height: cameraHeight }]}
              facing="back"
              enableTorch={torchOn}
              onCameraReady={() => setCameraReady(true)}
              onMountError={(event) => setNotice(event.message || "Camera could not start.")}
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
            </View>
            <View style={styles.barcodeHint} pointerEvents="none">
              <Barcode size={24} color={colors.ink} />
              <Text style={styles.barcodeHintText}>Align barcode inside the frame</Text>
            </View>
          </View>
        )
      ) : (
        <Text style={styles.notice}>Camera preview is Android-first. Use your phone camera to scan packages.</Text>
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
  hero: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "900"
  },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    paddingHorizontal: 2
  },
  agentHeader: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  agentIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.purple,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)"
  },
  agentHeaderText: {
    flex: 1,
    minWidth: 0
  },
  agentTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900"
  },
  agentMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  agentActions: {
    flexDirection: "row",
    gap: 10
  },
  agentActionButton: {
    flex: 1,
    height: 58,
    borderRadius: 18,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  agentActionText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  thumbnailRow: {
    minHeight: 112,
    gap: 10,
    paddingRight: 4
  },
  thumbnailCard: {
    width: 104,
    height: 104,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  thumbnailImage: {
    width: "100%",
    height: "100%"
  },
  thumbnailIndex: {
    position: "absolute",
    left: 8,
    top: 8,
    minWidth: 24,
    height: 24,
    borderRadius: 999,
    overflow: "hidden",
    textAlign: "center",
    color: colors.ink,
    fontSize: 13,
    lineHeight: 24,
    fontWeight: "900",
    backgroundColor: "rgba(0, 0, 0, 0.62)"
  },
  removeThumbnail: {
    position: "absolute",
    right: 7,
    top: 7,
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.66)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)"
  },
  addMoreCard: {
    width: 104,
    height: 104,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  emptyDropZone: {
    minHeight: 132,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  emptyDropText: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  promptInput: {
    minHeight: 104,
    borderRadius: 20,
    backgroundColor: colors.panel2,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "800",
    paddingHorizontal: 14,
    paddingVertical: 13,
    textAlignVertical: "top"
  },
  submitButton: {
    height: 58,
    borderRadius: 999,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.purple
  },
  disabledButton: {
    opacity: 0.48
  },
  submitText: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
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
  galleryButton: {
    height: 56,
    borderRadius: 18,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  galleryText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
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
  cameraCard: {
    overflow: "hidden",
    borderRadius: 26,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    position: "relative"
  },
  camera: {
    minHeight: 356
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
