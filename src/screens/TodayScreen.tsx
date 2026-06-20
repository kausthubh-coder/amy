import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  GestureResponderEvent,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  UIManager,
  View
} from "react-native";
import type { NativeSyntheticEvent, TextLayoutEventData } from "react-native";
import { Barcode, Camera, Flame, Mic, Plus, Settings } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { InteractivePressable } from "../components/InteractivePressable";
import { ModalShell } from "../components/ModalShell";
import { MacroRing, ProgressBar } from "../components/NutritionBits";
import { targetsFromCalories, totalsForDay } from "../domain/nutrition";
import { createId } from "../domain/seed";
import { FoodDraft, FoodEntry, MacroTotals } from "../domain/types";
import { feedback } from "../services/feedback";
import { getLocationContext } from "../services/location";
import { estimateMealText } from "../services/openRouter";
import { useAppData } from "../store/AppDataContext";
import { colors } from "../theme";
import { labelForDay } from "../utils/date";

export type CaptureMode = "type" | "barcode" | "photo" | "label" | "mic";
export type AppModal = "stats" | "settings" | "saved" | "capture" | null;

type LinePhase = "searching" | "calculating" | "done" | "error";
type LineStatus = {
  phase: LinePhase;
  runId: number;
  entryId?: string;
  message?: string;
};

type LineRow = {
  key: string;
  text: string;
  norm: string;
  completed: boolean;
  entry?: FoodEntry;
  status?: LineStatus;
};

const phaseText: Record<LinePhase, string> = {
  searching: "Searching",
  calculating: "Calculating",
  done: "",
  error: "Tap to edit"
};

const animatedNativeDriver = Platform.OS !== "web";
const NOTE_LINE_HEIGHT = 32;
const LINE_RAIL_WIDTH = 116;
const NOTE_INPUT_RIGHT_PADDING = LINE_RAIL_WIDTH + 8;

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

function animateLayout() {
  if (Platform.OS === "web") return;
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDaySwipeGesture(gesture: { dx: number; dy: number }) {
  return Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.1;
}

function normalizeMealLine(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function lineKey(index: number, text: string) {
  return `${index}:${normalizeMealLine(text)}`;
}

function splitLogLines(text: string) {
  return text.replace(/\r\n/g, "\n").split("\n");
}

function buildLineRows(text: string, entries: FoodEntry[], statuses: Record<string, LineStatus>): LineRow[] {
  const buckets = new Map<string, FoodEntry[]>();
  entries
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((entry) => {
      const key = normalizeMealLine(entry.rawInput ?? entry.title);
      if (!key) return;
      const list = buckets.get(key) ?? [];
      list.push(entry);
      buckets.set(key, list);
    });

  const used = new Map<string, number>();
  const lines = splitLogLines(text);
  return lines.map((line, index) => {
    const norm = normalizeMealLine(line);
    const key = lineKey(index, line);
    let entry: FoodEntry | undefined;
    if (norm) {
      const bucket = buckets.get(norm) ?? [];
      const usedCount = used.get(norm) ?? 0;
      entry = bucket[usedCount];
      used.set(norm, usedCount + 1);
    }
    return { key, text: line, norm, completed: index < lines.length - 1, entry, status: statuses[key] };
  });
}

function countLineNorms(text: string) {
  const counts = new Map<string, number>();
  splitLogLines(text).forEach((line) => {
    const norm = normalizeMealLine(line);
    if (!norm) return;
    counts.set(norm, (counts.get(norm) ?? 0) + 1);
  });
  return counts;
}

function measuredLineHeight(lineCount: number) {
  return Math.max(NOTE_LINE_HEIGHT, Math.ceil(lineCount) * NOTE_LINE_HEIGHT);
}

function totalMacros(drafts: FoodDraft[]): MacroTotals {
  return drafts.reduce(
    (sum, draft) => ({
      calories: sum.calories + draft.macros.calories,
      carbs: Math.round((sum.carbs + draft.macros.carbs) * 10) / 10,
      protein: Math.round((sum.protein + draft.macros.protein) * 10) / 10,
      fat: Math.round((sum.fat + draft.macros.fat) * 10) / 10
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 }
  );
}

function draftForLine(drafts: FoodDraft[], rawInput: string, day: string): FoodDraft {
  if (!drafts.length) {
    return {
      id: createId("draft_empty"),
      day,
      rawInput,
      title: rawInput,
      servingLabel: "1 serving",
      macros: { calories: 0, carbs: 0, protein: 0, fat: 0 },
      source: "manual",
      confidence: 0.1,
      sourceLabel: "Manual",
      createdAt: new Date().toISOString()
    };
  }

  if (drafts.length === 1) {
    const draft = drafts[0]!;
    return { ...draft, rawInput, title: draft.title.trim() || rawInput };
  }

  const confidence = drafts.reduce((sum, draft) => sum + draft.confidence, 0) / drafts.length;
  return {
    id: createId("draft_line"),
    day,
    rawInput,
    title: rawInput,
    servingLabel: `${drafts.length} items`,
    macros: totalMacros(drafts),
    source: drafts[0]?.source ?? "ai_text",
    confidence,
    sourceLabel: drafts[0]?.sourceLabel ?? "Amy estimate",
    createdAt: new Date().toISOString()
  };
}

function numeric(value: string, fallback: number) {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function PhaseIndicator({ phase }: { phase: LinePhase }) {
  const [dotCount, setDotCount] = useState(1);
  const opacity = useRef(new Animated.Value(0.65)).current;

  useEffect(() => {
    const dotTimer = setInterval(() => setDotCount((count) => (count % 3) + 1), 280);
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: animatedNativeDriver }),
        Animated.timing(opacity, { toValue: 0.62, duration: 420, useNativeDriver: animatedNativeDriver })
      ])
    );
    pulse.start();
    return () => {
      clearInterval(dotTimer);
      pulse.stop();
    };
  }, [opacity]);

  const label = phase === "error" ? phaseText.error : `${phaseText[phase]}${".".repeat(dotCount)}`;

  return (
    <Animated.View style={[styles.phasePill, { opacity }]}>
      <Text style={[styles.linePhaseText, phase === "error" && styles.lineErrorText]}>{label}</Text>
    </Animated.View>
  );
}

function FoodEditModal({
  entry,
  onClose,
  onSave,
  onDelete
}: {
  entry?: FoodEntry;
  onClose: () => void;
  onSave: (entry: FoodEntry, patch: Partial<FoodEntry>) => void;
  onDelete: (entry: FoodEntry) => void;
}) {
  const [title, setTitle] = useState("");
  const [servingLabel, setServingLabel] = useState("");
  const [calories, setCalories] = useState("");
  const [carbs, setCarbs] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");

  useEffect(() => {
    if (!entry) return;
    setTitle(entry.title);
    setServingLabel(entry.servingLabel);
    setCalories(String(entry.macros.calories));
    setCarbs(String(entry.macros.carbs));
    setProtein(String(entry.macros.protein));
    setFat(String(entry.macros.fat));
  }, [entry]);

  const target = entry ? targetsFromCalories(entry.macros.calories) : targetsFromCalories(0);

  return (
    <ModalShell visible={Boolean(entry)} title="Edit Food" onClose={onClose}>
      {entry ? (
        <View style={styles.editStack}>
          <View style={styles.editCard}>
            <Text style={styles.editLabel}>Food</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Food name" placeholderTextColor={colors.dim} style={styles.editInput} />
            <TextInput
              value={servingLabel}
              onChangeText={setServingLabel}
              placeholder="Serving size"
              placeholderTextColor={colors.dim}
              style={styles.editInput}
            />
          </View>

          <View style={styles.editCard}>
            <Text style={styles.editLabel}>Nutrition</Text>
            <TextInput value={calories} onChangeText={setCalories} keyboardType="number-pad" placeholder="Calories" placeholderTextColor={colors.dim} style={styles.editInput} />
            <View style={styles.macroInputs}>
              <TextInput value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" placeholder="Carbs" placeholderTextColor={colors.dim} style={styles.macroInput} />
              <TextInput value={protein} onChangeText={setProtein} keyboardType="decimal-pad" placeholder="Protein" placeholderTextColor={colors.dim} style={styles.macroInput} />
              <TextInput value={fat} onChangeText={setFat} keyboardType="decimal-pad" placeholder="Fat" placeholderTextColor={colors.dim} style={styles.macroInput} />
            </View>
            <Text style={styles.editHint}>Target shape from this calorie value: C {target.carbsTarget} · P {target.proteinTarget} · F {target.fatTarget}</Text>
          </View>

          <View style={styles.editActions}>
            <InteractivePressable
              feedbackKind="delete"
              onPress={() => onDelete(entry)}
              style={[styles.editButton, styles.deleteButton]}
            >
              <Text style={styles.deleteText}>Remove</Text>
            </InteractivePressable>
            <InteractivePressable
              feedbackKind="edit"
              onPress={() =>
                onSave(entry, {
                  title: title.trim() || entry.title,
                  servingLabel: servingLabel.trim() || entry.servingLabel,
                  macros: {
                    calories: Math.max(0, Math.round(numeric(calories, entry.macros.calories))),
                    carbs: Math.max(0, Math.round(numeric(carbs, entry.macros.carbs) * 10) / 10),
                    protein: Math.max(0, Math.round(numeric(protein, entry.macros.protein) * 10) / 10),
                    fat: Math.max(0, Math.round(numeric(fat, entry.macros.fat) * 10) / 10)
                  }
                })
              }
              style={[styles.editButton, styles.saveButton]}
            >
              <Text style={styles.saveText}>Save</Text>
            </InteractivePressable>
          </View>
        </View>
      ) : null}
    </ModalShell>
  );
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
  const { data, selectedDay, shiftDay, updateDayNote, addEntryFromDraft, updateEntry, deleteEntry } = useAppData();
  const [workingText, setWorkingText] = useState("");
  const [lineStatuses, setLineStatuses] = useState<Record<string, LineStatus>>({});
  const [notice, setNotice] = useState("");
  const [listening, setListening] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [calorieOverlayVisible, setCalorieOverlayVisible] = useState(false);
  const [lineHeights, setLineHeights] = useState<Record<string, number>>({});
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
  const workingTextRef = useRef("");
  const selectedDayRef = useRef(selectedDay);
  const entriesRef = useRef<FoodEntry[]>([]);
  const statusRef = useRef<Record<string, LineStatus>>({});
  const lineRunRef = useRef<Record<string, number>>({});
  const pruningRef = useRef(new Set<string>());
  const externalNoteRef = useRef("");
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const note = data?.dayNotes.find((item) => item.day === selectedDay)?.text ?? "";
  const entries = useMemo(() => data?.entries.filter((entry) => entry.day === selectedDay) ?? [], [data?.entries, selectedDay]);
  const totals = useMemo(() => (data ? totalsForDay(data.entries, selectedDay) : { calories: 0, carbs: 0, protein: 0, fat: 0 }), [data, selectedDay]);
  const loggedDayCount = useMemo(() => new Set((data?.entries ?? []).map((entry) => entry.day)).size, [data?.entries]);
  const lineRows = useMemo(() => buildLineRows(workingText, entries, lineStatuses), [entries, lineStatuses, workingText]);
  const editingEntry = useMemo(() => entries.find((entry) => entry.id === editingEntryId), [editingEntryId, entries]);
  const dockBottom = keyboardOpen && Platform.OS === "ios" ? 10 : Math.max(insets.bottom + 10, 18);
  const dockReserve = dockBottom + 78;
  const measuredTextWidth = Math.max(80, windowWidth - 36 - NOTE_INPUT_RIGHT_PADDING);

  useEffect(() => {
    workingTextRef.current = workingText;
  }, [workingText]);

  useEffect(() => {
    selectedDayRef.current = selectedDay;
  }, [selectedDay]);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    statusRef.current = lineStatuses;
  }, [lineStatuses]);

  useEffect(() => {
    externalNoteRef.current = note;
    setWorkingText(note);
    setLineStatuses({});
    setLineHeights({});
    setNotice("");
    setEditingEntryId(null);
    setCalorieOverlayVisible(false);
  }, [selectedDay]);

  useEffect(() => {
    if (note === externalNoteRef.current) return;
    externalNoteRef.current = note;
    if (inputFocused || listening || note === workingTextRef.current) return;
    animateLayout();
    setWorkingText(note);
  }, [inputFocused, listening, note]);

  useEffect(() => {
    const activeKeys = new Set(buildLineRows(workingText, entriesRef.current, {}).map((row) => row.key));
    setLineStatuses((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([key]) => activeKeys.has(key)));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
    setLineHeights((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([key]) => activeKeys.has(key)));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [workingText]);

  const rememberLineHeight = useCallback((key: string, event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const nextHeight = measuredLineHeight(event.nativeEvent.lines.length || 1);
    setLineHeights((current) => (current[key] === nextHeight ? current : { ...current, [key]: nextHeight }));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (externalNoteRef.current === workingTextRef.current) return;
      updateDayNote(selectedDay, workingTextRef.current.trimEnd());
      externalNoteRef.current = workingTextRef.current.trimEnd();
    }, 500);
    return () => clearTimeout(timer);
  }, [selectedDay, updateDayNote, workingText]);

  const setLinePhase = useCallback((key: string, runId: number, phase: LinePhase, patch: Partial<LineStatus> = {}) => {
    animateLayout();
    setLineStatuses((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { runId }), ...patch, runId, phase }
    }));
  }, []);

	  const analyzeLine = useCallback(
	    async (row: LineRow) => {
	      if (!data || !row.completed || !row.norm || row.text.trim().length < 4) return;
	      const day = selectedDay;
	      const runId = (lineRunRef.current[row.key] ?? 0) + 1;
	      lineRunRef.current[row.key] = runId;
	      setLinePhase(row.key, runId, "searching");
	      await delay(360);

	      const locationContext = data.settings.locationForRestaurants ? await getLocationContext() : {};
	      if (lineRunRef.current[row.key] !== runId || selectedDayRef.current !== day) return;
	      setLinePhase(row.key, runId, "calculating");
	      await delay(260);

	      const result = await estimateMealText(row.text.trim(), day, {
        calorieBias: data.settings.calorieBias,
        locationLabel: locationContext.label,
        openRouterKey: data.settings.openRouterKey,
        openRouterModel: data.settings.openRouterModel
      });
      if (lineRunRef.current[row.key] !== runId || selectedDayRef.current !== day) return;

      const latestRows = buildLineRows(workingTextRef.current, entriesRef.current, statusRef.current);
      const stillVisible = latestRows.some((latestRow) => latestRow.key === row.key && latestRow.norm === row.norm && !latestRow.entry);
      if (!stillVisible) return;

      const draft = draftForLine(result.drafts, row.text.trim(), day);
      const entry = addEntryFromDraft(draft, row.text.trim());
      setLinePhase(row.key, runId, "done", { entryId: entry.id, message: result.error ?? result.notice });
      updateDayNote(day, workingTextRef.current.trimEnd());
      externalNoteRef.current = workingTextRef.current.trimEnd();
      const nextNotice = locationContext.error ?? result.error ?? "";
      setNotice(/add an openrouter key/i.test(nextNotice) ? "" : nextNotice);
      void feedback("log");
    },
    [addEntryFromDraft, data, selectedDay, setLinePhase, updateDayNote]
  );

  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(() => {
	      const rows = buildLineRows(workingTextRef.current, entriesRef.current, statusRef.current);
	      rows.forEach((row) => {
	        if (!row.completed || !row.norm || row.text.trim().length < 4 || row.entry) return;
	        const status = statusRef.current[row.key];
	        if (status) return;
	        void analyzeLine(row);
	      });
	    }, 120);
    return () => clearTimeout(timer);
  }, [
    analyzeLine,
    data,
    data?.settings.calorieBias,
    data?.settings.locationForRestaurants,
    data?.settings.openRouterKey,
    data?.settings.openRouterModel,
    selectedDay,
    workingText
  ]);

  useEffect(() => {
    if (!focusSignal) return;
    inputRef.current?.focus();
  }, [focusSignal]);

  useEffect(() => {
    if (!prefillText?.trim()) return;
    const key = `${focusSignal}:${prefillText}`;
    if (lastPrefillRef.current === key) return;
    lastPrefillRef.current = key;
    const next = workingTextRef.current.trim() ? `${workingTextRef.current.trimEnd()}\n${prefillText.trim()}` : prefillText.trim();
    animateLayout();
    setWorkingText(next);
    inputRef.current?.focus();
  }, [focusSignal, prefillText]);

  const abortDictation = useCallback(() => {
    dictationRequestedRef.current = false;
    acceptingSpeechRef.current = false;
    setListening(false);
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // Dictation may already be inactive when Android sends a late end/error event.
    }
  }, []);

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

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (keyboardOpen) setCalorieOverlayVisible(false);
  }, [keyboardOpen]);

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
    animateLayout();
    setWorkingText(nextText);
    if (event.isFinal) {
      updateDayNote(selectedDay, nextText);
      externalNoteRef.current = nextText;
      abortDictation();
    }
  });

  const performDaySwipe = useCallback(
    (dx: number, dy: number) => {
      if (!isDaySwipeGesture({ dx, dy })) return false;
      const now = Date.now();
      if (now - lastDaySwipeAtRef.current < 300) return true;
      lastDaySwipeAtRef.current = now;
      if (workingTextRef.current.trim()) updateDayNote(selectedDay, workingTextRef.current.trimEnd());
      skipNextBlurSaveRef.current = true;
      Keyboard.dismiss();
      inputRef.current?.blur();
      setNotice("");
      animateLayout();
      void feedback("swipe");
      shiftDay(dx < 0 ? 1 : -1);
      return true;
    },
    [selectedDay, shiftDay, updateDayNote]
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

  const toggleDictation = useCallback(async () => {
    const recognitionState = await ExpoSpeechRecognitionModule.getStateAsync().catch(() => "inactive");
    if (listening || acceptingSpeechRef.current || recognitionState === "starting" || recognitionState === "recognizing" || recognitionState === "stopping") {
      if (workingTextRef.current.trim()) updateDayNote(selectedDay, workingTextRef.current.trimEnd());
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
    speechBaseTextRef.current = workingTextRef.current.trim();
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
  }, [abortDictation, data?.settings.dictationLanguage, listening, selectedDay, updateDayNote]);

  useEffect(() => {
    if (!dictationSignal || lastDictationSignalRef.current === dictationSignal) return;
    lastDictationSignalRef.current = dictationSignal;
    inputRef.current?.focus();
    const timer = setTimeout(() => {
      void toggleDictation();
    }, 220);
    return () => clearTimeout(timer);
  }, [dictationSignal, toggleDictation]);

  const pruneDeletedLineEntries = (nextText: string) => {
    const counts = countLineNorms(nextText);
    const seen = new Map<string, number>();
    entriesRef.current
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .forEach((entry) => {
        const norm = normalizeMealLine(entry.rawInput ?? entry.title);
        if (!norm) return;
        const index = seen.get(norm) ?? 0;
        seen.set(norm, index + 1);
        if (index < (counts.get(norm) ?? 0) || pruningRef.current.has(entry.id)) return;
        pruningRef.current.add(entry.id);
        deleteEntry(entry.id);
        setTimeout(() => pruningRef.current.delete(entry.id), 1200);
      });
  };

  const handleTextChange = (value: string) => {
    animateLayout();
    pruneDeletedLineEntries(value);
    setWorkingText(value);
    if (notice) setNotice("");
    if (calorieOverlayVisible) setCalorieOverlayVisible(false);
  };

  const replaceLineForEntry = (entry: FoodEntry, replacement: string | null) => {
    const target = normalizeMealLine(entry.rawInput ?? entry.title);
    if (!target) return;
    let removed = false;
    const nextLines = splitLogLines(workingTextRef.current)
      .map((line) => {
        if (!removed && normalizeMealLine(line) === target) {
          removed = true;
          return replacement;
        }
        return line;
      })
      .filter((line): line is string => line !== null);
    const next = nextLines.join("\n");
    animateLayout();
    setWorkingText(next);
    updateDayNote(selectedDay, next.trimEnd());
    externalNoteRef.current = next.trimEnd();
  };

  const saveEntry = (entry: FoodEntry, patch: Partial<FoodEntry>) => {
    const titleChanged = typeof patch.title === "string" && patch.title.trim() && patch.title !== entry.title;
    updateEntry(entry.id, titleChanged ? { ...patch, rawInput: patch.title } : patch);
    if (titleChanged) replaceLineForEntry(entry, patch.title ?? entry.title);
    setEditingEntryId(null);
    setNotice("Food updated.");
  };

  const removeEntry = (entry: FoodEntry) => {
    deleteEntry(entry.id);
    replaceLineForEntry(entry, null);
    setEditingEntryId(null);
    setNotice("Food removed.");
  };

  if (!data) return null;

  const calorieProgress = data.goal.dailyCalories > 0 ? totals.calories / data.goal.dailyCalories : 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
	      style={[styles.screen, { paddingTop: Math.max(insets.top + 10, 24) }]}
      onTouchStart={rememberTouchStart}
      onTouchEnd={finishTouchSwipe}
      {...panResponder.panHandlers}
    >
	      <View style={styles.top}>
	        <Image source={require("../../assets/icon-cat-alt.png")} style={styles.logo} />
	        <InteractivePressable onPress={() => shiftDay(0)} style={styles.todayPill}>
	          <Text style={styles.todayText}>{labelForDay(selectedDay)}</Text>
	        </InteractivePressable>
	        <View style={styles.topActions}>
	          <InteractivePressable onPress={() => openModal("stats")} style={styles.streakPill}>
	            <Flame size={20} color={colors.orange} fill={colors.orange} strokeWidth={2.2} />
	            <Text style={styles.streakText}>{loggedDayCount}</Text>
	          </InteractivePressable>
	          <InteractivePressable onPress={() => openModal("settings")} style={styles.settingsPill}>
	            <Settings size={22} color={colors.ink} strokeWidth={2.5} />
	          </InteractivePressable>
	        </View>
	      </View>

      <View style={[styles.body, { paddingBottom: dockReserve }]}>
        <View style={styles.logArea}>
          <TextInput
            ref={inputRef}
            value={workingText}
            onChangeText={handleTextChange}
            onFocus={() => {
              if (dockBlurTimerRef.current) clearTimeout(dockBlurTimerRef.current);
              setInputFocused(true);
            }}
            onBlur={() => {
              if (skipNextBlurSaveRef.current) skipNextBlurSaveRef.current = false;
              else updateDayNote(selectedDay, workingTextRef.current.trimEnd());
              if (dockBlurTimerRef.current) clearTimeout(dockBlurTimerRef.current);
              dockBlurTimerRef.current = setTimeout(() => setInputFocused(false), 180);
            }}
            multiline
            placeholder="Start logging your meals..."
            placeholderTextColor={colors.dim}
            style={styles.noteInput}
          />

          <View pointerEvents="none" style={styles.measureLayer}>
            {lineRows.map((row) => (
              <Text
                key={`measure-${row.key}`}
                onTextLayout={(event) => rememberLineHeight(row.key, event)}
                style={[styles.measureText, { width: measuredTextWidth }]}
              >
                {row.text || " "}
              </Text>
            ))}
          </View>

          <View style={styles.lineRail}>
            {lineRows.map((row) => {
              const activePhase = row.status?.phase && row.status.phase !== "done" ? row.status.phase : undefined;
              const label = activePhase ? phaseText[activePhase] : row.entry ? `${row.entry.macros.calories.toLocaleString()} cal` : "";
              const canEdit = Boolean(row.entry);
              const rowHeight = lineHeights[row.key] ?? NOTE_LINE_HEIGHT;
              return (
                <View key={row.key} style={[styles.lineRailSlot, { height: rowHeight }]}>
                  {canEdit ? (
                    <InteractivePressable
                      feedbackKind="edit"
                      onPress={() => setEditingEntryId(row.entry?.id ?? null)}
                      style={styles.lineCalorieHit}
                    >
                      <Text style={styles.sideCalories}>{label}</Text>
                    </InteractivePressable>
	                  ) : (
	                    activePhase ? <PhaseIndicator phase={activePhase} /> : <Text style={styles.sideCalories}>{label}</Text>
	                  )}
                </View>
              );
            })}
          </View>
        </View>

        <ScrollView
          style={styles.results}
          contentContainerStyle={styles.resultsContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
	        >
	          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
	        </ScrollView>
	      </View>

      {calorieOverlayVisible ? (
        <View style={[styles.calorieOverlay, { bottom: dockBottom + 66 }]}>
          <Text style={styles.overlayTitle}>Goals</Text>
          <View style={styles.overlayCalorieRow}>
            <View style={styles.overlayCalorieLabel}>
              <Text style={styles.overlayCalorieEmoji}>🔥</Text>
              <Text style={styles.overlayCalorieText}>Calories</Text>
            </View>
            <Text style={styles.overlayCalorieValue}>
              {totals.calories.toLocaleString()} / {data.goal.dailyCalories.toLocaleString()}
            </Text>
          </View>
          <ProgressBar value={calorieProgress} />
          <View style={styles.overlayRings}>
            <MacroRing label="Carbs" value={totals.carbs} target={data.goal.carbsTarget} color={colors.green} />
            <MacroRing label="Protein" value={totals.protein} target={data.goal.proteinTarget} color={colors.pink} />
            <MacroRing label="Fat" value={totals.fat} target={data.goal.fatTarget} color={colors.green} />
          </View>
        </View>
      ) : null}

	        <View style={[styles.dock, { bottom: dockBottom }]}>
	          <InteractivePressable
              accessibilityLabel={calorieOverlayVisible ? "Hide calorie details" : "Show calorie details"}
              onPress={() => {
                Keyboard.dismiss();
                setCalorieOverlayVisible((visible) => !visible);
              }}
              style={[styles.caloriePill, calorieOverlayVisible && styles.caloriePillActive]}
            >
	            <Text style={styles.calorieEmoji}>🔥</Text>
	            <Text style={styles.caloriePillText}>{totals.calories.toLocaleString()}</Text>
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
	            <Barcode size={24} color={colors.ink} strokeWidth={2.4} />
	          </InteractivePressable>
        </View>

      <FoodEditModal entry={editingEntry} onClose={() => setEditingEntryId(null)} onSave={saveEntry} onDelete={removeEntry} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    position: "relative",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 0
  },
  top: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center"
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 12,
    position: "absolute",
    left: 0
  },
  topActions: {
    position: "absolute",
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  todayPill: {
    minWidth: 116,
    maxWidth: 164,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  todayText: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  streakPill: {
    height: 48,
    minWidth: 70,
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    paddingLeft: 16,
    paddingRight: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  settingsPill: {
    height: 48,
    width: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  streakText: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900"
  },
  body: {
    flex: 1,
    paddingTop: 50
  },
  logArea: {
    minHeight: 128,
    position: "relative"
  },
  noteInput: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: NOTE_LINE_HEIGHT,
    fontWeight: "500",
    padding: 0,
    paddingRight: NOTE_INPUT_RIGHT_PADDING,
    textAlignVertical: "top"
  },
  measureLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    opacity: 0
  },
  measureText: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: NOTE_LINE_HEIGHT,
    fontWeight: "500",
    padding: 0
  },
  lineRail: {
    position: "absolute",
    top: 0,
    right: 0,
    width: LINE_RAIL_WIDTH,
    alignItems: "flex-end"
  },
  lineRailSlot: {
    alignItems: "flex-end",
    justifyContent: "flex-start"
  },
  lineCalorieHit: {
    minWidth: 86,
    minHeight: NOTE_LINE_HEIGHT,
    alignItems: "flex-end",
    justifyContent: "center"
  },
  sideCalories: {
    color: colors.dim,
    fontSize: 24,
    lineHeight: NOTE_LINE_HEIGHT,
    fontWeight: "800"
  },
  phasePill: {
    minWidth: 100,
    minHeight: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  linePhaseText: {
    color: colors.dim,
    fontSize: 12,
    fontWeight: "800"
  },
  lineErrorText: {
    fontSize: 18,
    color: colors.pink
  },
  results: {
    flex: 1
  },
  resultsContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
    gap: 12
  },
  notice: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  dock: {
    position: "absolute",
    left: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 7
  },
  caloriePill: {
    flex: 1,
    minWidth: 92,
    height: 52,
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  caloriePillActive: {
    backgroundColor: colors.panel2,
    borderColor: colors.green
  },
  caloriePillText: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900"
  },
  calorieEmoji: {
    fontSize: 20,
    lineHeight: 24
  },
  calorieOverlay: {
    position: "absolute",
    left: 18,
    right: 18,
    zIndex: 12,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    backgroundColor: "rgba(32, 32, 34, 0.9)",
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 14,
    elevation: 16
  },
  overlayTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "900"
  },
  overlayCalorieRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14
  },
  overlayCalorieLabel: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  overlayCalorieText: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900"
  },
  overlayCalorieEmoji: {
    fontSize: 21,
    lineHeight: 24
  },
  overlayCalorieValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900"
  },
  overlayRings: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 4
  },
  roundButton: {
    width: 48,
    height: 48,
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
  editStack: {
    gap: 14
  },
  editCard: {
    gap: 10,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  editLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "900"
  },
  editInput: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: colors.panel2,
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    paddingHorizontal: 14
  },
  macroInputs: {
    flexDirection: "row",
    gap: 10
  },
  macroInput: {
    flex: 1,
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: colors.panel2,
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    paddingHorizontal: 12
  },
  editHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19
  },
  editActions: {
    flexDirection: "row",
    gap: 10
  },
  editButton: {
    flex: 1,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  deleteButton: {
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  saveButton: {
    backgroundColor: colors.purple
  },
  deleteText: {
    color: colors.pink,
    fontSize: 16,
    fontWeight: "900"
  },
  saveText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  }
});
