import { BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Barcode, Camera, Check, Flashlight, Image as ImageIcon, KeyRound, Minus, Plus, RotateCcw, Search, Sparkles, X } from "lucide-react-native";

import { AgentError } from "../agent/client";
import { estimateImages } from "../agent/estimate";
import { relevantKnownFoods } from "../agent/match";
import { DraftParts, sumMacros } from "../agent/parse";
import { InteractivePressable } from "../components/InteractivePressable";
import { useToast } from "../components/Toast";
import { formatPortionLabel, macrosForPortion } from "../domain/nutrition";
import { createId } from "../domain/seed";
import { FoodDraft, FoodItem } from "../domain/types";
import { feedback } from "../services/feedback";
import { AgentImageInput, prepareAgentImage } from "../services/images";
import { getLocationContext } from "../services/location";
import { lookupOpenFoodFactsProduct } from "../services/openFoodFacts";
import { useAppData } from "../store/AppDataContext";
import { colors } from "../theme";
import { confidenceLabel } from "./FoodEditModal";
import { CaptureMode } from "./TodayScreen";

type AgentImage = AgentImageInput & { id: string };

type ImageReview = { parts: DraftParts; items: FoodItem[]; note: string; imageUri: string; locationNote?: string };

const MAX_PHOTOS = 6;

function cleanLine(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function imageFromAsset(asset: ImagePicker.ImagePickerAsset | undefined): AgentImage | undefined {
  if (!asset?.uri) return undefined;
  return { id: createId("agent_image"), uri: asset.uri, width: asset.width, height: asset.height };
}

function deviceLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
  } catch {
    return "en-US";
  }
}

function MacroLine({ calories, carbs, protein, fat }: { calories: number; carbs: number; protein: number; fat: number }) {
  return (
    <View style={styles.macroLine}>
      <Text style={styles.macroCalories}>{calories.toLocaleString()} cal</Text>
      <Text style={[styles.macroChip, { color: colors.pink }]}>C {Math.round(carbs)}</Text>
      <Text style={[styles.macroChip, { color: colors.blue }]}>P {Math.round(protein)}</Text>
      <Text style={[styles.macroChip, { color: colors.yellow }]}>F {Math.round(fat)}</Text>
    </View>
  );
}

export function CaptureModal({
  mode,
  onDone,
  focusTypeInput,
  openSettings,
  prefillBarcode
}: {
  mode: CaptureMode;
  onDone: () => void;
  focusTypeInput: () => void;
  openSettings: () => void;
  prefillBarcode?: string;
}) {
  const { data, selectedDay, addEntryFromDraft } = useAppData();
  const { showToast } = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [caption, setCaption] = useState("");
  const [notice, setNotice] = useState("");
  const [agentImages, setAgentImages] = useState<AgentImage[]>([]);
  const [imageReview, setImageReview] = useState<ImageReview | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [product, setProduct] = useState<FoodDraft | null>(null);
  const [servings, setServings] = useState("1");
  const lastPrefillLookupRef = useRef("");
  const lookupInFlightRef = useRef(false);
  const failedCodesRef = useRef(new Map<string, number>());
  const { height } = useWindowDimensions();

  const hasKey = Boolean(data?.settings.openRouterKey.trim());
  const canUseCamera = Platform.OS !== "web" && mode === "barcode";
  const cameraHeight = Math.round(Math.max(300, Math.min(400, height * 0.46)));

  useEffect(() => {
    setCaption("");
    setAgentImages([]);
    setImageReview(null);
    setProduct(null);
    setManualCode("");
    setNotice("");
    setProgress("");
    failedCodesRef.current.clear();
  }, [mode]);

  const lookupBarcode = async (code: string, source: "scan" | "typed") => {
    if (lookupInFlightRef.current) return;
    const cleanCode = code.replace(/\D/g, "");
    if (cleanCode.length < 6) {
      if (source === "typed") setNotice("Barcodes are 8 to 14 digits. Check the number under the bars.");
      return;
    }
    // A code that just failed is ignored while it stays in frame, instead of hammering Open Food Facts.
    const failedAt = failedCodesRef.current.get(cleanCode);
    if (source === "scan" && failedAt && Date.now() - failedAt < 60000) return;

    lookupInFlightRef.current = true;
    setBusy(true);
    setNotice("");
    setProgress(`Looking up ${cleanCode}...`);
    try {
      const result = await lookupOpenFoodFactsProduct(cleanCode, selectedDay);
      if (result.status === "found") {
        void feedback("success");
        setProduct(result.draft);
        setServings(result.draft.portion?.unit === "g" ? String(result.draft.portion.amount) : "1");
      } else {
        failedCodesRef.current.set(cleanCode, Date.now());
        void feedback("warning");
        setManualCode((current) => current || cleanCode);
        setNotice(`${result.message}${result.detail ? `\n${result.detail}` : ""}`);
      }
    } finally {
      lookupInFlightRef.current = false;
      setBusy(false);
      setProgress("");
    }
  };

  useEffect(() => {
    const cleanCode = prefillBarcode?.replace(/\D/g, "") ?? "";
    if (mode !== "barcode" || !cleanCode || lastPrefillLookupRef.current === cleanCode) return;
    lastPrefillLookupRef.current = cleanCode;
    // Codes arriving from links are looked up but still need the user's "Log it" tap.
    void lookupBarcode(cleanCode, "typed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, prefillBarcode]);

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (!result.data || busy || product) return;
    void lookupBarcode(result.data, "scan");
  };

  const productPortion = product?.portion ? { ...product.portion, amount: Math.max(0, Number(servings.replace(",", ".")) || 0) } : undefined;
  const productMacros = productPortion ? macrosForPortion(productPortion) : product?.macros;

  const stepServings = (delta: number) => {
    const step = product?.portion?.unit === "g" ? delta * 10 : delta * 0.5;
    const next = Math.max(step > 0 ? step : 0, (Number(servings.replace(",", ".")) || 0) + step);
    setServings(String(Number(next.toFixed(2))));
  };

  const logProduct = () => {
    if (!product || !productMacros) return;
    if (productPortion && productPortion.amount <= 0) {
      setNotice("Enter how much you had.");
      return;
    }
    const draft: FoodDraft = productPortion
      ? { ...product, portion: productPortion, macros: productMacros, servingLabel: formatPortionLabel(productPortion) }
      : product;
    addEntryFromDraft(draft, draft.title, { allowDuplicateNoteLine: true });
    showToast({ kind: "success", message: `Logged ${draft.title}: ${productMacros.calories.toLocaleString()} cal` });
    onDone();
  };

  const addAgentImages = (images: AgentImage[]) => {
    if (!images.length) return;
    setNotice("");
    setAgentImages((current) => {
      const next = [...current, ...images];
      if (next.length > MAX_PHOTOS) setNotice(`Amy uses up to ${MAX_PHOTOS} photos per meal; extra photos were left out.`);
      return next.slice(0, MAX_PHOTOS);
    });
  };

  const pickAgentImages = async () => {
    if (busy) return;
    try {
      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!mediaPermission.granted) {
        setNotice(`Gallery permission is needed to choose ${mode === "label" ? "nutrition label photos" : "food photos"}.`);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: MAX_PHOTOS
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
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        setNotice(`Camera permission is needed to take ${mode === "label" ? "a nutrition label photo" : "a food photo"}.`);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9, allowsEditing: false });
      if (result.canceled) return;
      const image = imageFromAsset(result.assets?.[0]);
      if (image) addAgentImages([image]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not take this photo.");
    }
  };

  const submitImageAgent = async () => {
    if (busy || !data) return;
    if (!agentImages.length) {
      setNotice(`Add at least one ${mode === "label" ? "nutrition label photo" : "food photo"} first.`);
      return;
    }
    const imageMode = mode === "label" ? "label" : "photo";
    const note = caption.trim();
    try {
      setBusy(true);
      setNotice("");
      setProgress(agentImages.length > 1 ? `Preparing ${agentImages.length} photos...` : "Preparing photo...");
      const dataUrls = await Promise.all(agentImages.map(prepareAgentImage));
      const location = data.settings.locationForRestaurants && imageMode === "photo" ? await getLocationContext() : {};
      setProgress(imageMode === "label" ? "Reading the label..." : "Looking at your meal...");
      const parts = await estimateImages(
        { dataUrls, mode: imageMode, note },
        { apiKey: data.settings.openRouterKey, model: data.settings.openRouterModel, bias: data.settings.calorieBias },
        {
          now: new Date(),
          locale: deviceLocale(),
          locationLabel: location.label,
          countryCode: location.countryCode,
          knownFoods: note ? relevantKnownFoods([note], data.corrections, data.savedMeals) : []
        }
      );
      void feedback("success");
      setImageReview({
        parts,
        items: parts.items ?? [],
        note,
        imageUri: agentImages[0]?.uri ?? "",
        locationNote: location.error
      });
    } catch (error) {
      void feedback("error");
      const agentError = error instanceof AgentError ? error : null;
      setNotice(agentError?.message ?? (error instanceof Error ? error.message : "Could not run the food agent."));
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const logImageReview = () => {
    if (!imageReview) return;
    const imageMode = mode === "label" ? "label" : "photo";
    const { parts, items, note } = imageReview;
    const multi = (parts.items?.length ?? 0) > 0;
    if (multi && !items.length) {
      setNotice("Every item was removed. Try again or add another photo.");
      return;
    }
    const macros = multi ? sumMacros(items.map((item) => item.macros)) : parts.macros;
    const title = multi ? items.map((item) => item.title).join(", ") : parts.title;
    const line = cleanLine(note) || cleanLine(title) || (imageMode === "label" ? "Nutrition label" : "Meal photo");
    const draft: FoodDraft = {
      id: createId("draft_image"),
      day: selectedDay,
      rawInput: line,
      title: cleanLine(title) || line,
      servingLabel: multi ? `${items.length} ${items.length === 1 ? "item" : "items"}` : parts.servingLabel,
      macros,
      source: imageMode === "label" ? "label_ocr" : "ai_photo",
      confidence: parts.confidence,
      sourceLabel: parts.sourceLabel,
      portion: multi ? undefined : parts.portion,
      items: multi ? items : undefined,
      assumptions: parts.assumptions,
      imageUri: imageReview.imageUri,
      createdAt: new Date().toISOString()
    };
    addEntryFromDraft(draft, line, { allowDuplicateNoteLine: true });
    showToast({ kind: "success", message: `Logged ${macros.calories.toLocaleString()} cal. Tap the line's calories to adjust.` });
    onDone();
  };

  if (mode === "type" || mode === "mic") {
    return (
      <View style={styles.stack}>
        <Text style={styles.hero}>{mode === "mic" ? "Ready for dictation." : "Ready to type a meal."}</Text>
        <InteractivePressable
          accessibilityRole="button"
          feedbackKind="success"
          onPress={() => {
            focusTypeInput();
            onDone();
          }}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryText}>{mode === "mic" ? "Go to mic" : "Open typing"}</Text>
        </InteractivePressable>
      </View>
    );
  }

  if (mode === "photo" || mode === "label") {
    const isLabel = mode === "label";

    if (!hasKey) {
      return (
        <View style={styles.stack}>
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <KeyRound size={22} color={colors.orange} strokeWidth={2.5} />
              <Text style={styles.panelTitle}>{isLabel ? "Label reading needs an AI key" : "Photo estimates need an AI key"}</Text>
            </View>
            <Text style={styles.copy}>
              Amy sends photos to the AI model you choose through OpenRouter, using your own key. Without one you can still type calories, use saved meals, and scan barcodes.
            </Text>
          </View>
          <InteractivePressable accessibilityRole="button" onPress={openSettings} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Add a key in Settings</Text>
          </InteractivePressable>
        </View>
      );
    }

    if (imageReview) {
      const { parts, items } = imageReview;
      const multi = (parts.items?.length ?? 0) > 0;
      const totals = multi ? sumMacros(items.map((item) => item.macros)) : parts.macros;
      const status = confidenceLabel({ source: isLabel ? "label_ocr" : "ai_photo", confidence: parts.confidence });
      const tone = status.tone === "low" ? colors.orange : status.tone === "ok" ? colors.yellow : colors.green;
      return (
        <View style={styles.stack}>
          <View style={styles.panel}>
            <View style={styles.reviewHeader}>
              {imageReview.imageUri ? <Image source={{ uri: imageReview.imageUri }} style={styles.reviewThumb} /> : null}
              <View style={styles.reviewCopy}>
                <Text style={styles.panelTitle} numberOfLines={2}>
                  {multi ? `${items.length} ${items.length === 1 ? "item" : "items"} found` : parts.title}
                </Text>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: tone }]} />
                  <Text style={styles.statusText}>{status.text}</Text>
                </View>
              </View>
            </View>

            {multi ? (
              items.map((item, index) => (
                <View key={`${item.title}-${index}`} style={styles.itemRow}>
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.itemMeta} numberOfLines={1}>
                      {item.servingLabel}
                    </Text>
                  </View>
                  <Text style={styles.itemCalories}>{item.macros.calories.toLocaleString()}</Text>
                  <InteractivePressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.title}`}
                    accessibilityHint="Leaves this item out of the log."
                    feedbackKind="delete"
                    onPress={() => setImageReview((current) => (current ? { ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) } : current))}
                    style={styles.itemRemove}
                  >
                    <X size={18} color={colors.muted} strokeWidth={2.6} />
                  </InteractivePressable>
                </View>
              ))
            ) : (
              <Text style={styles.itemMeta}>{parts.servingLabel}</Text>
            )}

            <MacroLine {...totals} />
            {parts.assumptions ? <Text style={styles.copy}>{parts.assumptions}</Text> : null}
            {imageReview.locationNote ? <Text style={styles.itemMeta}>{imageReview.locationNote}</Text> : null}
          </View>

          <View style={styles.buttonRow}>
            <InteractivePressable
              accessibilityRole="button"
              accessibilityHint="Goes back to your photos so you can add a note or another angle."
              onPress={() => {
                setImageReview(null);
                setNotice("Add a note (for example 'ate half' or 'no dressing') or another angle, then submit again.");
              }}
              style={styles.secondaryButton}
            >
              <RotateCcw size={18} color={colors.ink} strokeWidth={2.6} />
              <Text style={styles.secondaryText}>Not right</Text>
            </InteractivePressable>
            <InteractivePressable accessibilityRole="button" feedbackKind="log" onPress={logImageReview} style={[styles.primaryButton, styles.grow]}>
              <Check size={20} color={colors.ink} strokeWidth={3} />
              <Text style={styles.primaryText}>Log {totals.calories.toLocaleString()} cal</Text>
            </InteractivePressable>
          </View>
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        </View>
      );
    }

    const submitDisabled = busy || agentImages.length === 0;
    return (
      <View style={styles.stack}>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <ImageIcon size={22} color={colors.pink} strokeWidth={2.5} />
            <View style={styles.reviewCopy}>
              <Text style={styles.panelTitle}>{isLabel ? "Label photos" : "Meal photos"}</Text>
              <Text style={styles.itemMeta}>
                {agentImages.length ? `${agentImages.length}/${MAX_PHOTOS} ready` : isLabel ? "Capture the nutrition facts panel, flat and in focus." : "One clear photo is enough. Add angles for big meals."}
              </Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <InteractivePressable
              accessibilityRole="button"
              accessibilityLabel={isLabel ? "Take a nutrition label photo" : "Take a meal photo"}
              accessibilityHint="Opens the camera."
              onPress={takeAgentPhoto}
              disabled={busy || agentImages.length >= MAX_PHOTOS}
              style={[styles.secondaryButton, styles.grow]}
            >
              <Camera size={20} color={colors.ink} strokeWidth={2.5} />
              <Text style={styles.secondaryText}>Camera</Text>
            </InteractivePressable>
            <InteractivePressable
              accessibilityRole="button"
              accessibilityLabel={isLabel ? "Choose nutrition label photos" : "Choose meal photos"}
              accessibilityHint="Opens your photo library."
              onPress={pickAgentImages}
              disabled={busy || agentImages.length >= MAX_PHOTOS}
              style={[styles.secondaryButton, styles.grow]}
            >
              <ImageIcon size={20} color={colors.ink} strokeWidth={2.5} />
              <Text style={styles.secondaryText}>Photos</Text>
            </InteractivePressable>
          </View>

          {agentImages.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
              {agentImages.map((image, index) => (
                <View key={image.id} style={[styles.previewCard, busy && styles.dimmed]}>
                  <Image source={{ uri: image.uri }} style={styles.previewImage} />
                  <InteractivePressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${index + 1}`}
                    onPress={() => setAgentImages((current) => current.filter((item) => item.id !== image.id))}
                    disabled={busy}
                    style={styles.removePhotoButton}
                  >
                    <X size={18} color={colors.ink} strokeWidth={2.7} />
                  </InteractivePressable>
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>

        <TextInput
          value={caption}
          onChangeText={setCaption}
          multiline
          editable={!busy}
          placeholder={isLabel ? "How much did you have? e.g. 'whole bag', '2 bars'" : "Optional note, e.g. 'ate half', 'from Chipotle'"}
          placeholderTextColor={colors.muted}
          accessibilityLabel="Note for the estimate"
          style={styles.promptInput}
        />

        <InteractivePressable
          accessibilityRole="button"
          accessibilityLabel={isLabel ? "Read nutrition label" : "Estimate meal"}
          accessibilityState={{ disabled: submitDisabled, busy }}
          onPress={submitImageAgent}
          disabled={submitDisabled}
          style={styles.primaryButton}
        >
          {busy ? <ActivityIndicator color={colors.ink} /> : <Sparkles size={20} color={colors.ink} strokeWidth={2.6} />}
          <Text style={styles.primaryText}>{busy ? progress || "Working..." : isLabel ? "Read label" : "Estimate meal"}</Text>
        </InteractivePressable>
        {busy ? <Text style={styles.itemMeta}>This usually takes 5 to 20 seconds. You will review the result before it is logged.</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </View>
    );
  }

  if (product && productMacros) {
    const unitIsGrams = product.portion?.unit === "g";
    return (
      <View style={styles.stack}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{product.title}</Text>
          <Text style={styles.itemMeta}>
            Open Food Facts · {product.barcode} · per {product.portion?.servingLabel ?? product.servingLabel}
          </Text>
          {product.portion ? (
            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>{unitIsGrams ? "Grams" : "Servings"}</Text>
              <InteractivePressable accessibilityRole="button" accessibilityLabel="Less" onPress={() => stepServings(-1)} style={styles.stepperButton}>
                <Minus size={20} color={colors.ink} strokeWidth={3} />
              </InteractivePressable>
              <TextInput
                value={servings}
                onChangeText={setServings}
                keyboardType="decimal-pad"
                selectTextOnFocus
                accessibilityLabel={unitIsGrams ? "Grams eaten" : "Servings eaten"}
                style={styles.stepperInput}
              />
              <InteractivePressable accessibilityRole="button" accessibilityLabel="More" onPress={() => stepServings(1)} style={styles.stepperButton}>
                <Plus size={20} color={colors.ink} strokeWidth={3} />
              </InteractivePressable>
            </View>
          ) : null}
          <MacroLine {...productMacros} />
          <Text style={styles.itemMeta}>Open Food Facts is community data. Compare with the package if a number looks off.</Text>
        </View>
        <View style={styles.buttonRow}>
          <InteractivePressable
            accessibilityRole="button"
            onPress={() => {
              setProduct(null);
              setNotice("");
            }}
            style={styles.secondaryButton}
          >
            <Barcode size={18} color={colors.ink} strokeWidth={2.4} />
            <Text style={styles.secondaryText}>Scan again</Text>
          </InteractivePressable>
          <InteractivePressable accessibilityRole="button" feedbackKind="log" onPress={logProduct} style={[styles.primaryButton, styles.grow]}>
            <Check size={20} color={colors.ink} strokeWidth={3} />
            <Text style={styles.primaryText}>Log {productMacros.calories.toLocaleString()} cal</Text>
          </InteractivePressable>
        </View>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {canUseCamera ? (
        !permission?.granted ? (
          <InteractivePressable accessibilityRole="button" onPress={requestPermission} style={styles.primaryButton}>
            <Camera size={22} color={colors.ink} />
            <Text style={styles.primaryText}>Allow camera to scan</Text>
          </InteractivePressable>
        ) : (
          <View style={[styles.cameraCard, { minHeight: cameraHeight }]}>
            <CameraView
              style={[styles.camera, { height: cameraHeight }]}
              facing="back"
              enableTorch={torchOn}
              onMountError={(event) => setNotice(event.message || "Camera could not start. Type the barcode below instead.")}
              barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"] }}
              onBarcodeScanned={busy ? undefined : handleBarcode}
            />
            <View style={styles.scanFrame} pointerEvents="none" />
            <View style={styles.overlayTop}>
              <InteractivePressable
                accessibilityRole="button"
                accessibilityLabel={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
                accessibilityState={{ selected: torchOn }}
                onPress={() => setTorchOn((value) => !value)}
                style={[styles.overlayButton, torchOn && styles.overlayButtonOn]}
              >
                <Flashlight size={21} color={torchOn ? colors.bg : colors.ink} strokeWidth={2.5} />
              </InteractivePressable>
            </View>
            <View style={styles.barcodeHint} pointerEvents="none">
              {busy ? <ActivityIndicator color={colors.ink} /> : <Barcode size={22} color={colors.ink} />}
              <Text style={styles.barcodeHintText}>{busy ? progress : "Hold the barcode inside the frame"}</Text>
            </View>
          </View>
        )
      ) : (
        <Text style={styles.copy}>Camera scanning is Android-only. Type the barcode digits instead.</Text>
      )}

      <View style={styles.manualRow}>
        <TextInput
          value={manualCode}
          onChangeText={(value) => setManualCode(value.replace(/\D/g, "").slice(0, 14))}
          keyboardType="number-pad"
          returnKeyType="search"
          onSubmitEditing={() => void lookupBarcode(manualCode, "typed")}
          placeholder="Or type the barcode digits"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Barcode digits"
          style={styles.manualInput}
        />
        <InteractivePressable
          accessibilityRole="button"
          accessibilityLabel="Look up barcode"
          onPress={() => void lookupBarcode(manualCode, "typed")}
          disabled={busy || manualCode.length < 6}
          style={styles.manualButton}
        >
          {busy && !canUseCamera ? <ActivityIndicator color={colors.ink} /> : <Search size={20} color={colors.ink} strokeWidth={2.6} />}
        </InteractivePressable>
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  grow: {
    flex: 1
  },
  dimmed: {
    opacity: 0.55
  },
  hero: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "900"
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700"
  },
  panel: {
    gap: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  panelTitle: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  reviewThumb: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.panel2
  },
  reviewCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 999
  },
  statusText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line
  },
  itemCopy: {
    flex: 1,
    minWidth: 0
  },
  itemTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800"
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700"
  },
  itemCalories: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  itemRemove: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  macroLine: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line
  },
  macroCalories: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900"
  },
  macroChip: {
    fontSize: 15,
    fontWeight: "900"
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 999,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: colors.purple
  },
  primaryText: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  secondaryButton: {
    minHeight: 56,
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  secondaryText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  previewRow: {
    gap: 10
  },
  previewCard: {
    width: 104,
    height: 104,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.panel2
  },
  previewImage: {
    width: "100%",
    height: "100%"
  },
  removePhotoButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.55)"
  },
  promptInput: {
    minHeight: 64,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlignVertical: "top"
  },
  notice: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  cameraCard: {
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#000"
  },
  camera: {
    width: "100%"
  },
  scanFrame: {
    position: "absolute",
    left: "10%",
    right: "10%",
    top: "32%",
    height: "32%",
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.9)"
  },
  overlayTop: {
    position: "absolute",
    top: 12,
    right: 12
  },
  overlayButton: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.55)"
  },
  overlayButtonOn: {
    backgroundColor: colors.yellow
  },
  barcodeHint: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 46,
    borderRadius: 999,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)"
  },
  barcodeHintText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800"
  },
  manualRow: {
    flexDirection: "row",
    gap: 10
  },
  manualInput: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    paddingHorizontal: 16
  },
  manualButton: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.purple
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  stepperLabel: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  stepperInput: {
    width: 76,
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: colors.panel2,
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center"
  }
});
