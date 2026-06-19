import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  GestureResponderEvent,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Camera, Keyboard as KeyboardIcon, Mic, Plus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { InteractivePressable } from "../components/InteractivePressable";
import { MacroFooter, MacroRing, ProgressBar } from "../components/NutritionBits";
import { totalsForDay } from "../domain/nutrition";
import { FoodDraft } from "../domain/types";
import { getLocationContext } from "../services/location";
import { estimateMealText } from "../services/openRouter";
import { useAppData } from "../store/AppDataContext";
import { colors } from "../theme";
import { labelForDay } from "../utils/date";

export type CaptureMode = "type" | "barcode" | "photo" | "label" | "mic";
export type AppModal = "stats" | "settings" | "calories" | "saved" | "capture" | null;

function isDaySwipeGesture(gesture: { dx: number; dy: number }) {
  return Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.1;
}

function DraftCard({ draft }: { draft: FoodDraft }) {
  const { confirmDraft, updateDraft } = useAppData();
  return (
    <View style={styles.draftCard}>
      <View>
        <Text style={styles.draftEyebrow}>{draft.sourceLabel ?? "Amy matched it"}</Text>
        <Text style={styles.draftCalories}>{draft.macros.calories.toLocaleString()} cal</Text>
        <Text style={styles.draftTitle}>{draft.title}</Text>
        <Text style={styles.confidence}>{Math.round(draft.confidence * 100)}% confidence · {draft.servingLabel}</Text>
      </View>
      <View style={styles.draftActions}>
        <InteractivePressable onPress={() => updateDraft(draft.id, { macros: { ...draft.macros, calories: draft.macros.calories + 50 } })} style={[styles.actionButton, styles.ghostButton]}>
          <Text style={styles.ghostText}>+50</Text>
        </InteractivePressable>
        <InteractivePressable feedbackKind="success" onPress={() => confirmDraft(draft.id)} style={[styles.actionButton, styles.confirmButton]}>
          <Text style={styles.confirmText}>Log</Text>
        </InteractivePressable>
      </View>
    </View>
  );
}

function TodayGoalsCard({ totals, data }: { totals: ReturnType<typeof totalsForDay>; data: NonNullable<ReturnType<typeof useAppData>["data"]> }) {
  return (
    <View style={styles.goalsCard}>
      <Text style={styles.goalsTitle}>Goals</Text>
      <View style={styles.goalLineTop}>
        <Text style={styles.goalName}>🔥 Calories</Text>
        <Text style={styles.goalValue}>{Math.round(totals.calories).toLocaleString()} / {data.goal.dailyCalories.toLocaleString()}</Text>
      </View>
      <ProgressBar value={totals.calories / data.goal.dailyCalories} />
      <View style={styles.goalRings}>
        <MacroRing label="Carbs" value={totals.carbs} target={data.goal.carbsTarget} color={colors.green} />
        <MacroRing label="Protein" value={totals.protein} target={data.goal.proteinTarget} color={colors.pink} />
        <MacroRing label="Fat" value={totals.fat} target={data.goal.fatTarget} color={colors.green} />
      </View>
    </View>
  );
}

function normalizeMealText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isTextEstimate(draft: FoodDraft) {
  return draft.source === "ai_text" || draft.source === "local_fallback";
}

export function TodayScreen({
  openModal,
  focusSignal,
  dictationSignal,
  prefillText
}: {
  openModal: (modal: AppModal, captureMode?: CaptureMode) => void;
  focusSignal: number;
  dictationSignal?: number;
  prefillText?: string;
}) {
  const { data, selectedDay, shiftDay, updateDayNote, addDrafts } = useAppData();
  const [workingText, setWorkingText] = useState("");
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState("");
  const [listening, setListening] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const lastAnalyzedRef = useRef("");
  const analysisRunRef = useRef(0);
  const inputRef = useRef<TextInput>(null);
  const lastPrefillRef = useRef("");
  const lastDictationSignalRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastDaySwipeAtRef = useRef(0);
  const skipNextBlurSaveRef = useRef(false);
  const dockBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acceptingSpeechRef = useRef(false);
  const dictationRequestedRef = useRef(false);
  const speechBaseTextRef = useRef("");
  const insets = useSafeAreaInsets();

  const note = data?.dayNotes.find((item) => item.day === selectedDay)?.text ?? "";
  const totals = useMemo(() => (data ? totalsForDay(data.entries, selectedDay) : { calories: 0, carbs: 0, protein: 0, fat: 0 }), [data, selectedDay]);
  const visibleDrafts = useMemo(() => {
    const activeNote = normalizeMealText(workingText);
    return (data?.drafts ?? []).filter((draft) => {
      if (draft.day !== selectedDay) return false;
      if (!isTextEstimate(draft)) return true;
      if (!activeNote) return false;
      return normalizeMealText(draft.rawInput) === activeNote;
    });
  }, [data?.drafts, selectedDay, workingText]);
  const entries = data?.entries.filter((entry) => entry.day === selectedDay) ?? [];
  const showDock = inputFocused || listening;

  useEffect(() => {
    setWorkingText(note);
    setNotice("");
  }, [note, selectedDay]);

  useEffect(() => {
    lastAnalyzedRef.current = "";
  }, [selectedDay]);

  useEffect(() => {
    if (!focusSignal) return;
    inputRef.current?.focus();
  }, [focusSignal]);

  useEffect(() => {
    if (!prefillText?.trim()) return;
    const key = `${focusSignal}:${prefillText}`;
    if (lastPrefillRef.current === key) return;
    lastPrefillRef.current = key;
    setWorkingText(prefillText);
    inputRef.current?.focus();
  }, [focusSignal, prefillText]);

  useEffect(() => {
    const text = workingText.trim();
    if (text.length < 5 || text === lastAnalyzedRef.current) return;

    let cancelled = false;
    const runId = analysisRunRef.current + 1;
    analysisRunRef.current = runId;
    const timer = setTimeout(async () => {
      lastAnalyzedRef.current = text;
      setSearching(true);
      const locationContext = data?.settings.locationForRestaurants ? await getLocationContext() : {};
      const result = await estimateMealText(text, selectedDay, {
        calorieBias: data?.settings.calorieBias,
        locationLabel: locationContext.label
      });
      if (cancelled || analysisRunRef.current !== runId) return;
      updateDayNote(selectedDay, text);
      addDrafts(result.drafts);
      Keyboard.dismiss();
      inputRef.current?.blur();
      setNotice(locationContext.error ?? (result.error ? result.error : result.notice ?? ""));
      setSearching(false);
    }, 950);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setSearching(false);
    };
  }, [addDrafts, data?.settings.calorieBias, data?.settings.locationForRestaurants, selectedDay, updateDayNote, workingText]);

  const abortDictation = () => {
    dictationRequestedRef.current = false;
    acceptingSpeechRef.current = false;
    setListening(false);
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // Dictation may already be inactive when Android sends a late end/error event.
    }
  };

  useEffect(() => {
    return () => {
      if (dockBlurTimerRef.current) clearTimeout(dockBlurTimerRef.current);
      dictationRequestedRef.current = false;
      acceptingSpeechRef.current = false;
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // Ignore cleanup races with native recognition teardown.
      }
    };
  }, []);

  useSpeechRecognitionEvent("start", () => {
    if (!dictationRequestedRef.current) {
      abortDictation();
      return;
    }
    acceptingSpeechRef.current = true;
    setListening(true);
  });
  useSpeechRecognitionEvent("end", () => abortDictation());
  useSpeechRecognitionEvent("error", (event) => {
    dictationRequestedRef.current = false;
    acceptingSpeechRef.current = false;
    setListening(false);
    if (event.error !== "aborted" && event.error !== "no-speech" && event.error !== "speech-timeout") {
      setNotice(event.message || "Dictation stopped.");
    }
  });
  useSpeechRecognitionEvent("result", (event) => {
    if (!acceptingSpeechRef.current) return;
    const transcript = event.results[0]?.transcript?.trim();
    if (!transcript) return;
    const base = speechBaseTextRef.current;
    const nextText = base ? `${base}\n${transcript}` : transcript;
    setWorkingText(nextText);
    if (event.isFinal) {
      updateDayNote(selectedDay, nextText);
      abortDictation();
    }
  });

  const performDaySwipe = useCallback(
    (dx: number, dy: number) => {
      if (!isDaySwipeGesture({ dx, dy })) return false;
      const now = Date.now();
      if (now - lastDaySwipeAtRef.current < 300) return true;
      lastDaySwipeAtRef.current = now;
      if (workingText.trim()) updateDayNote(selectedDay, workingText);
      skipNextBlurSaveRef.current = true;
      Keyboard.dismiss();
      inputRef.current?.blur();
      setNotice("");
      shiftDay(dx < 0 ? 1 : -1);
      return true;
    },
    [selectedDay, shiftDay, updateDayNote, workingText]
  );

  const rememberTouchStart = (event: GestureResponderEvent) => {
    const touch = event.nativeEvent.touches?.[0] ?? event.nativeEvent.changedTouches?.[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.pageX, y: touch.pageY };
  };

  const finishTouchSwipe = (event: GestureResponderEvent) => {
    const touch = event.nativeEvent.changedTouches?.[0] ?? event.nativeEvent.touches?.[0];
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!touch || !start) return;
    performDaySwipe(touch.pageX - start.x, touch.pageY - start.y);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => isDaySwipeGesture(gesture),
        onMoveShouldSetPanResponderCapture: (_, gesture) => isDaySwipeGesture(gesture),
        onPanResponderRelease: (_, gesture) => {
          performDaySwipe(gesture.dx, gesture.dy);
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true
      }),
    [performDaySwipe]
  );

  const toggleDictation = async () => {
    const recognitionState = await ExpoSpeechRecognitionModule.getStateAsync().catch(() => "inactive");
    if (listening || acceptingSpeechRef.current || recognitionState === "starting" || recognitionState === "recognizing" || recognitionState === "stopping") {
      if (workingText.trim()) updateDayNote(selectedDay, workingText);
      abortDictation();
      return;
    }
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setNotice("Speech recognition is not available on this device.");
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setNotice("Microphone permission is needed for dictation.");
      return;
    }
    speechBaseTextRef.current = workingText.trim();
    dictationRequestedRef.current = true;
    acceptingSpeechRef.current = true;
    setListening(true);
    setNotice("");
    try {
      ExpoSpeechRecognitionModule.start({
        lang: data?.settings.dictationLanguage === "auto" ? "en-US" : data?.settings.dictationLanguage,
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        addsPunctuation: true,
        contextualStrings: ["calories", "protein", "chicken", "rice", "toast", "barcode", "sauce"]
      });
    } catch {
      dictationRequestedRef.current = false;
      acceptingSpeechRef.current = false;
      setListening(false);
      setNotice("Dictation could not start on this device.");
    }
  };

  useEffect(() => {
    if (!dictationSignal || lastDictationSignalRef.current === dictationSignal) return;
    lastDictationSignalRef.current = dictationSignal;
    inputRef.current?.focus();
    const timer = setTimeout(() => {
      void toggleDictation();
    }, 220);
    return () => clearTimeout(timer);
  }, [dictationSignal]);

  if (!data) return null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.screen, { paddingTop: Math.max(insets.top + 12, Platform.OS === "android" ? 42 : 26), paddingBottom: Math.max(insets.bottom + 8, 14) }]}
      onTouchStart={rememberTouchStart}
      onTouchEnd={finishTouchSwipe}
      {...panResponder.panHandlers}
    >
      <View style={styles.top}>
        <Image source={require("../../assets/icon-cat-alt.png")} style={styles.logo} />
        <InteractivePressable onPress={() => shiftDay(0)} style={styles.todayPill}>
          <Text style={styles.todayText}>{labelForDay(selectedDay)}</Text>
        </InteractivePressable>
        <InteractivePressable onPress={() => openModal("stats")} style={styles.streakPill}>
          <Text style={styles.streakText}>🔥 {entries.length ? 1 : 0}</Text>
        </InteractivePressable>
        <InteractivePressable onPress={() => openModal("settings")} style={styles.settingsPill}>
          <Text style={styles.settingsText}>⚙</Text>
        </InteractivePressable>
      </View>

      <View style={[styles.body, showDock && styles.bodyDocked]}>
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            value={workingText}
            onChangeText={setWorkingText}
            onFocus={() => {
              if (dockBlurTimerRef.current) clearTimeout(dockBlurTimerRef.current);
              setInputFocused(true);
            }}
            onBlur={() => {
              if (skipNextBlurSaveRef.current) skipNextBlurSaveRef.current = false;
              else updateDayNote(selectedDay, workingText);
              if (dockBlurTimerRef.current) clearTimeout(dockBlurTimerRef.current);
              dockBlurTimerRef.current = setTimeout(() => setInputFocused(false), 180);
            }}
            multiline
            placeholder="Start logging your meals..."
            placeholderTextColor={colors.dim}
            style={styles.noteInput}
          />
          <View style={styles.calorieStatus}>
            {searching ? <ActivityIndicator color={colors.dim} /> : <Text style={styles.sideCalories}>{totals.calories ? `${totals.calories.toLocaleString()} cal` : ""}</Text>}
          </View>
        </View>

        <ScrollView style={styles.results} contentContainerStyle={[styles.resultsContent, { paddingBottom: showDock ? 128 : 18 }]} showsVerticalScrollIndicator={false}>
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {visibleDrafts.map((draft) => <DraftCard key={draft.id} draft={draft} />)}
          {totals.calories > 0 && visibleDrafts.length === 0 ? <TodayGoalsCard totals={totals} data={data} /> : null}
          {entries.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              <Text style={styles.entryTitle}>{entry.title}</Text>
              <Text style={styles.entryCals}>{entry.macros.calories} cal</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {showDock ? (
        <View style={styles.dock}>
          <InteractivePressable onPress={() => openModal("calories")} style={styles.caloriePill}>
            <Text style={styles.caloriePillText}>🔥 {totals.calories.toLocaleString()}</Text>
          </InteractivePressable>
          <InteractivePressable onPress={toggleDictation} style={[styles.roundButton, listening && styles.roundButtonOn]}>
            <Mic size={24} color={listening ? colors.ink : colors.blue} strokeWidth={2.6} />
          </InteractivePressable>
          <InteractivePressable onPress={() => openModal("capture", "photo")} style={styles.roundButton}>
            <Camera size={24} color="#F141FF" strokeWidth={2.6} />
          </InteractivePressable>
          <InteractivePressable onPress={() => openModal("saved")} style={styles.roundButton}>
            <Plus size={26} color={colors.orange} strokeWidth={2.8} />
          </InteractivePressable>
          <InteractivePressable onPress={() => openModal("capture", "barcode")} style={styles.roundButton}>
            <KeyboardIcon size={24} color={colors.ink} strokeWidth={2.4} />
          </InteractivePressable>
        </View>
      ) : (
        <InteractivePressable onPress={() => openModal("calories")} style={styles.footerWrap}>
          <MacroFooter totals={totals} />
        </InteractivePressable>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 22,
    paddingTop: 18
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 12,
    marginRight: "auto"
  },
  todayPill: {
    minWidth: 108,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  todayText: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900"
  },
  streakPill: {
    height: 48,
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
    paddingLeft: 16,
    paddingRight: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: colors.line
  },
  settingsPill: {
    height: 48,
    width: 48,
    marginLeft: -10,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: colors.line
  },
  streakText: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900"
  },
  settingsText: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900"
  },
  body: {
    flex: 1,
    paddingTop: 58
  },
  bodyDocked: {
    paddingBottom: 76
  },
  inputRow: {
    minHeight: 118,
    flexDirection: "row",
    gap: 12
  },
  noteInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 29,
    lineHeight: 38,
    fontWeight: "500",
    textAlignVertical: "top"
  },
  calorieStatus: {
    width: 112,
    alignItems: "flex-end",
    paddingTop: 6
  },
  sideCalories: {
    color: colors.dim,
    fontSize: 28,
    fontWeight: "800"
  },
  results: {
    flex: 1
  },
  resultsContent: {
    gap: 12
  },
  notice: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  draftCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 16
  },
  draftEyebrow: {
    color: colors.purple,
    fontSize: 14,
    fontWeight: "900"
  },
  draftCalories: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 34,
    fontWeight: "900"
  },
  draftTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "800"
  },
  confidence: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700"
  },
  draftActions: {
    flexDirection: "row",
    gap: 10,
    alignSelf: "stretch"
  },
  actionButton: {
    minWidth: 112,
    maxWidth: 160,
    height: 52,
    flex: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  ghostButton: {
    backgroundColor: colors.panel2
  },
  ghostText: {
    color: colors.ink,
    fontWeight: "900"
  },
  confirmButton: {
    backgroundColor: colors.purple
  },
  confirmText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  entryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12
  },
  entryTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800"
  },
  entryCals: {
    color: colors.muted,
    fontSize: 17,
    fontWeight: "900"
  },
  goalsCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 13
  },
  goalsTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900"
  },
  goalLineTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14
  },
  goalName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  goalValue: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  goalRings: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 8,
    paddingTop: 8
  },
  dock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingBottom: 12
  },
  caloriePill: {
    flex: 1,
    minWidth: 136,
    height: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  caloriePillText: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900"
  },
  roundButton: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  roundButtonOn: {
    backgroundColor: colors.purple
  },
  footerWrap: {
    paddingBottom: 10
  }
});
