import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Dimensions,
  GestureResponderEvent,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  UIManager,
  View
} from "react-native";
import type { KeyboardEvent, NativeSyntheticEvent, TextLayoutEventData } from "react-native";
import { Barcode, Camera, Flame, Mic, Plus, Settings } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AgentError } from "../agent/client";
import { estimateTextLines } from "../agent/estimate";
import { findLocalMatch, relevantKnownFoods } from "../agent/match";
import { DraftParts } from "../agent/parse";
import { shouldUseWebSearch } from "../agent/prompt";
import { InteractivePressable } from "../components/InteractivePressable";
import { MacroRing, ProgressBar } from "../components/NutritionBits";
import { ToastViewport, useToast } from "../components/Toast";
import { buildLineRows, entriesWithoutLines, isLoggableLine, LineRow as GenericLineRow, sanitizePrefill, singleLineEdit } from "../domain/lines";
import { totalsForDay } from "../domain/nutrition";
import { createId } from "../domain/seed";
import { currentStreakDays } from "../domain/streaks";
import { FoodDraft, FoodEntry, FoodSource } from "../domain/types";
import { feedback } from "../services/feedback";
import { getLocationContext } from "../services/location";
import { useAppData } from "../store/AppDataContext";
import { colors } from "../theme";
import { labelForDay } from "../utils/date";
import { FoodEditModal, FoodFields } from "./FoodEditModal";

export type CaptureMode = "type" | "barcode" | "photo" | "label" | "mic";
export type AppModal = "stats" | "settings" | "saved" | "capture" | null;

type LinePhase = "estimating" | "searching" | "error" | "needs-calories" | "not-food";
type LineStatus = {
  phase: LinePhase;
  runId: number;
  message?: string;
};
type LineRow = GenericLineRow<LineStatus>;

const activePhaseText: Record<"estimating" | "searching", string> = {
  estimating: "Estimating",
  searching: "Searching"
};

const animatedNativeDriver = Platform.OS !== "web";
const NOTE_LINE_HEIGHT = 32;
const CALORIE_HIT_TARGET = 44;
const CALORIE_HIT_OFFSET = (CALORIE_HIT_TARGET - NOTE_LINE_HEIGHT) / 2;
const LINE_RAIL_WIDTH = 104;
const NOTE_ROW_GAP = 10;
const FLOATING_HEADER_HEIGHT = 52;
const FLOATING_HEADER_GUARD = 20;
const FLOATING_PANEL_BG = "rgba(32, 32, 34, 0.72)";
const FLOATING_PANEL_ACTIVE_BG = "rgba(42, 42, 46, 0.84)";
const FLOATING_PANEL_LINE = "rgba(255, 255, 255, 0.16)";
const ANALYZE_DEBOUNCE_MS = 350;
const REESTIMATE_SETTLE_MS = 1500;
const MAX_LINES_PER_REQUEST = 8;

// Lines the agent already judged "not food" this session, so notes like "felt tired" are not re-sent.
const notFoodLines = new Set<string>();

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

function animateLayout() {
  if (Platform.OS === "web") return;
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

function isDaySwipeGesture(gesture: { dx: number; dy: number }) {
  return Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.1;
}

function measuredLineHeight(lineCount: number) {
  return Math.max(NOTE_LINE_HEIGHT, Math.ceil(lineCount) * NOTE_LINE_HEIGHT);
}

function deviceLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
  } catch {
    return "en-US";
  }
}

function draftFromParts(parts: DraftParts | FoodFields, rawInput: string, day: string, source: FoodSource, extra: { confidence: number; sourceLabel: string; assumptions?: string }): FoodDraft {
  return {
    id: createId("draft_line"),
    day,
    rawInput,
    title: parts.title.trim() || rawInput,
    servingLabel: parts.servingLabel,
    macros: parts.macros,
    source,
    confidence: extra.confidence,
    sourceLabel: extra.sourceLabel,
    portion: parts.portion,
    items: parts.items,
    assumptions: extra.assumptions,
    createdAt: new Date().toISOString()
  };
}

function isLowConfidence(entry: FoodEntry) {
  return !entry.userEdited && entry.confidence < 0.6 && (entry.source === "ai_text" || entry.source === "ai_photo");
}

function PhaseIndicator({ label }: { label: string }) {
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

  return (
    <Animated.View accessibilityLabel={label} style={[styles.phasePill, { opacity }]}>
      <Text style={styles.linePhaseText}>
        {label}
        {".".repeat(dotCount)}
      </Text>
    </Animated.View>
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
  const { data, today, selectedDay, saveError, shiftDay, goToToday, updateDayNote, addEntryFromDraft, updateEntry, deleteEntry, restoreEntry, rememberFood, forgetFood, addSavedMeal } =
    useAppData();
  const { showToast } = useToast();
  const [workingText, setWorkingText] = useState("");
  const [commitLast, setCommitLast] = useState(false);
  const [lineStatuses, setLineStatuses] = useState<Record<string, LineStatus>>({});
  const [retryTick, setRetryTick] = useState(0);
  const [listening, setListening] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [manualLine, setManualLine] = useState<{ key: string; text: string } | null>(null);
  const [calorieOverlayVisible, setCalorieOverlayVisible] = useState(false);
  const [lineHeights, setLineHeights] = useState<Record<string, number>>({});
  const [noteScrollY, setNoteScrollY] = useState(0);
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
  const commitLastRef = useRef(false);
  const selectedDayRef = useRef(selectedDay);
  const entriesRef = useRef<FoodEntry[]>([]);
  const statusRef = useRef<Record<string, LineStatus>>({});
  const lineRunRef = useRef<Record<string, number>>({});
  const pendingReestimateRef = useRef(new Map<string, number>());
  const externalNoteRef = useRef("");
  const dataRef = useRef(data);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const note = data?.dayNotes.find((item) => item.day === selectedDay)?.text ?? "";
  const entries = useMemo(() => data?.entries.filter((entry) => entry.day === selectedDay) ?? [], [data?.entries, selectedDay]);
  const totals = useMemo(() => (data ? totalsForDay(data.entries, selectedDay) : { calories: 0, carbs: 0, protein: 0, fat: 0 }), [data, selectedDay]);
  const streakCount = useMemo(() => currentStreakDays(data?.entries ?? [], today), [data?.entries, today]);
  const lineRows = useMemo(() => buildLineRows(workingText, entries, lineStatuses, commitLast), [commitLast, entries, lineStatuses, workingText]);
  const editingEntry = useMemo(() => entries.find((entry) => entry.id === editingEntryId), [editingEntryId, entries]);
  const hasKey = Boolean(data?.settings.openRouterKey.trim());
  const compactChrome = windowWidth < 390;
  const dockSideInset = windowWidth >= 720 ? Math.max(18, (windowWidth - 720) / 2) : compactChrome ? 14 : 18;
  const floatingHeaderTop = Math.max(insets.top + (compactChrome ? 4 : 8), compactChrome ? 38 : 40);
  const contentTopInset = floatingHeaderTop + FLOATING_HEADER_HEIGHT + (compactChrome ? 16 : FLOATING_HEADER_GUARD) + (saveError ? 44 : 0);
  const keyboardDockOffset =
    inputFocused && keyboardOpen && keyboardHeight > 0
      ? Platform.OS === "ios"
        ? Math.max(insets.bottom + 18, 24)
        : keyboardHeight + 16
      : 0;
  const dockBottom = keyboardDockOffset || Math.max(insets.bottom + 10, 18);
  const dockReserve = dockBottom + 92;
  const measuredTextWidth = Math.max(80, windowWidth - 36 - LINE_RAIL_WIDTH - NOTE_ROW_GAP);

  workingTextRef.current = workingText;
  commitLastRef.current = commitLast;
  selectedDayRef.current = selectedDay;
  entriesRef.current = entries;
  statusRef.current = lineStatuses;
  dataRef.current = data;

  const persistNote = useCallback(
    (day: string, text: string) => {
      const trimmed = text.trimEnd();
      updateDayNote(day, trimmed);
      externalNoteRef.current = trimmed;
    },
    [updateDayNote]
  );

  // Day change: load that day's note. Entries that somehow lost their line get one back, so
  // nothing can count toward the total while being invisible in the log.
  useEffect(() => {
    const dayEntries = dataRef.current?.entries.filter((entry) => entry.day === selectedDay) ?? [];
    const orphans = entriesWithoutLines(note, dayEntries);
    const repaired = orphans.length ? [note.trimEnd(), ...orphans.map((entry) => (entry.rawInput ?? entry.title).replace(/[\r\n]+/g, " "))].filter(Boolean).join("\n") : note;
    externalNoteRef.current = repaired;
    if (repaired !== note) updateDayNote(selectedDay, repaired);
    setWorkingText(repaired);
    setCommitLast(Boolean(repaired.trim()));
    setLineStatuses({});
    setLineHeights({});
    setNoteScrollY(0);
    setEditingEntryId(null);
    setManualLine(null);
    setCalorieOverlayVisible(false);
    pendingReestimateRef.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  // Lines appended outside the editor (photo, barcode, saved meal) merge into what is being typed.
  useEffect(() => {
    if (note === externalNoteRef.current) return;
    const previousExternalNote = externalNoteRef.current;
    if (note === workingTextRef.current) return;

    let nextText = note;
    if (inputFocused || listening) {
      const current = workingTextRef.current.trimEnd();
      const previous = previousExternalNote.trimEnd();
      const appended = previous && note.startsWith(`${previous}\n`) ? note.slice(previous.length + 1).trimEnd() : !previous ? note.trimEnd() : "";
      if (!appended) return;
      nextText = current ? `${current}\n${appended}` : appended;
    }

    externalNoteRef.current = nextText;
    if (nextText === workingTextRef.current) return;
    animateLayout();
    setWorkingText(nextText);
    setCommitLast(true);
  }, [inputFocused, listening, note]);

  useEffect(() => {
    const activeKeys = new Set(buildLineRows(workingText, entriesRef.current, {}).map((row) => row.key));
    const prune = <T,>(current: Record<string, T>) => {
      const next = Object.fromEntries(Object.entries(current).filter(([key]) => activeKeys.has(key)));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    };
    setLineStatuses(prune);
    setLineHeights(prune);
  }, [workingText]);

  const rememberLineHeight = useCallback((key: string, event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const nextHeight = measuredLineHeight(event.nativeEvent.lines.length || 1);
    setLineHeights((current) => (current[key] === nextHeight ? current : { ...current, [key]: nextHeight }));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (externalNoteRef.current === workingTextRef.current.trimEnd()) return;
      persistNote(selectedDay, workingTextRef.current);
    }, 500);
    return () => clearTimeout(timer);
  }, [persistNote, selectedDay, workingText]);

  // Leaving the app commits the line being typed and flushes the note.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") return;
      persistNote(selectedDayRef.current, workingTextRef.current);
      if (workingTextRef.current.trim()) setCommitLast(true);
    });
    return () => subscription.remove();
  }, [persistNote]);

  const setStatus = useCallback((key: string, status: LineStatus | null) => {
    animateLayout();
    setLineStatuses((current) => {
      if (!status) {
        if (!(key in current)) return current;
        const { [key]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [key]: status };
    });
  }, []);

  const agentContext = useCallback(async (lines: string[]) => {
    const current = dataRef.current;
    const location = current?.settings.locationForRestaurants ? await getLocationContext() : {};
    const batch = new Set(lines.map((line) => line.trim().toLowerCase()));
    const earlierLines = buildLineRows(workingTextRef.current, entriesRef.current, {})
      .filter((row) => row.entry && !batch.has(row.text.trim().toLowerCase()))
      .map((row) => `${row.text.trim()} (${row.entry?.macros.calories ?? 0} kcal)`);
    return {
      location,
      context: {
        now: new Date(),
        locale: deviceLocale(),
        locationLabel: location.label,
        countryCode: location.countryCode,
        earlierLines,
        knownFoods: relevantKnownFoods(lines, current?.corrections ?? [], current?.savedMeals ?? [])
      }
    };
  }, []);

  const reportAgentError = useCallback(
    (error: AgentError) => {
      showToast({
        kind: "error",
        message: error.message,
        actionLabel: error.kind === "auth" || error.kind === "credits" || error.kind === "model" ? "Settings" : undefined,
        onAction: () => openModal("settings")
      });
    },
    [openModal, showToast]
  );

  const analyzeRows = useCallback(
    async (rows: LineRow[]) => {
      const current = dataRef.current;
      if (!current || !rows.length) return;
      const day = selectedDayRef.current;
      const stillWanted = (row: LineRow, runId: number) =>
        lineRunRef.current[row.key] === runId &&
        selectedDayRef.current === day &&
        buildLineRows(workingTextRef.current, entriesRef.current, {}, commitLastRef.current).some((latest) => latest.key === row.key && latest.completed && !latest.entry);

      const remote: Array<{ row: LineRow; runId: number }> = [];
      rows.forEach((row) => {
        const runId = (lineRunRef.current[row.key] ?? 0) + 1;
        lineRunRef.current[row.key] = runId;
        const text = row.text.trim();
        const local = findLocalMatch(text, current.corrections, current.savedMeals);
        if (local) {
          addEntryFromDraft(draftFromParts(local, text, day, local.source, { confidence: local.confidence, sourceLabel: local.sourceLabel }), text, { appendNoteLine: false });
          void feedback("log");
          return;
        }
        if (!current.settings.openRouterKey.trim()) {
          setStatus(row.key, { phase: "needs-calories", runId });
          return;
        }
        setStatus(row.key, { phase: shouldUseWebSearch(text) ? "searching" : "estimating", runId });
        remote.push({ row, runId });
      });

      for (let start = 0; start < remote.length; start += MAX_LINES_PER_REQUEST) {
        const chunk = remote.slice(start, start + MAX_LINES_PER_REQUEST);
        const lines = chunk.map(({ row }) => row.text.trim());
        try {
          const { location, context } = await agentContext(lines);
          const results = await estimateTextLines(
            lines,
            { apiKey: current.settings.openRouterKey, model: current.settings.openRouterModel, bias: current.settings.calorieBias },
            context
          );
          let logged = 0;
          chunk.forEach(({ row, runId }, index) => {
            if (!stillWanted(row, runId)) return;
            const result = results[index];
            const text = row.text.trim();
            if (!result || result.status === "error") {
              setStatus(row.key, { phase: "error", runId, message: result?.error.message ?? "No estimate came back for this line." });
            } else if (result.status === "not-food") {
              notFoodLines.add(row.norm);
              setStatus(row.key, { phase: "not-food", runId, message: result.note });
            } else {
              const { draft } = result;
              addEntryFromDraft(
                draftFromParts(draft, text, day, "ai_text", { confidence: draft.confidence, sourceLabel: draft.sourceLabel, assumptions: draft.assumptions }),
                text,
                { appendNoteLine: false }
              );
              setStatus(row.key, null);
              logged += 1;
            }
          });
          if (logged) void feedback("log");
          if (location.error && logged) showToast({ kind: "info", message: location.error });
        } catch (error) {
          const agentError = error instanceof AgentError ? error : new AgentError("network", error instanceof Error ? error.message : "The estimate failed.");
          chunk.forEach(({ row, runId }) => {
            if (lineRunRef.current[row.key] === runId) setStatus(row.key, { phase: "error", runId, message: agentError.message });
          });
          reportAgentError(agentError);
          if (agentError.fatal) {
            remote.slice(start + MAX_LINES_PER_REQUEST).forEach(({ row, runId }) => setStatus(row.key, { phase: "error", runId, message: agentError.message }));
            return;
          }
        }
      }
    },
    [addEntryFromDraft, agentContext, reportAgentError, setStatus, showToast]
  );

  const reestimateEntry = useCallback(
    async (entry: FoodEntry, options: { manual?: boolean } = {}) => {
      const current = dataRef.current;
      if (!current) return;
      const row = buildLineRows(workingTextRef.current, entriesRef.current, {}, true).find((item) => item.entry?.id === entry.id);
      const text = (row?.text ?? entry.rawInput ?? entry.title).trim();
      if (!text) return;
      if (!current.settings.openRouterKey.trim()) {
        if (options.manual) showToast({ kind: "info", message: "Add an OpenRouter key in Settings to re-estimate.", actionLabel: "Settings", onAction: () => openModal("settings") });
        return;
      }
      const key = row?.key ?? "";
      const runId = (lineRunRef.current[key] ?? 0) + 1;
      if (key) {
        lineRunRef.current[key] = runId;
        setStatus(key, { phase: shouldUseWebSearch(text) ? "searching" : "estimating", runId });
      }
      try {
        const { context } = await agentContext([text]);
        const [result] = await estimateTextLines(
          [text],
          { apiKey: current.settings.openRouterKey, model: current.settings.openRouterModel, bias: current.settings.calorieBias },
          context
        );
        if (key) setStatus(key, null);
        if (!entriesRef.current.some((item) => item.id === entry.id)) return;
        if (result?.status === "ok") {
          const { draft } = result;
          updateEntry(entry.id, {
            title: draft.title.trim() || text,
            servingLabel: draft.servingLabel,
            macros: draft.macros,
            portion: draft.portion,
            items: draft.items,
            assumptions: draft.assumptions,
            confidence: draft.confidence,
            sourceLabel: draft.sourceLabel,
            source: "ai_text",
            userEdited: undefined
          });
          if (options.manual) showToast({ kind: "success", message: `Re-estimated: ${draft.macros.calories.toLocaleString()} cal` });
        } else if (options.manual) {
          showToast({ kind: "error", message: result?.status === "error" ? result.error.message : "Amy does not think this line is food." });
        }
      } catch (error) {
        if (key) setStatus(key, null);
        const agentError = error instanceof AgentError ? error : new AgentError("network", "The estimate failed.");
        if (options.manual) reportAgentError(agentError);
      }
    },
    [agentContext, openModal, reportAgentError, setStatus, showToast, updateEntry]
  );

  // Estimate completed lines that have no entry yet. Everything pending goes out as one batch.
  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(() => {
      const rows = buildLineRows(workingTextRef.current, entriesRef.current, statusRef.current, commitLastRef.current);
      const pending = rows.filter((row) => row.completed && !row.entry && !row.status && isLoggableLine(row.text) && !notFoodLines.has(row.norm));
      if (pending.length) void analyzeRows(pending);
    }, ANALYZE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [analyzeRows, commitLast, data, entries, retryTick, selectedDay, workingText]);

  // A line edited in place keeps its entry; once typing settles, AI-made entries refresh themselves.
  useEffect(() => {
    if (!pendingReestimateRef.current.size) return;
    const timer = setTimeout(() => {
      const ids = Array.from(pendingReestimateRef.current.keys());
      pendingReestimateRef.current.clear();
      const rows = buildLineRows(workingTextRef.current, entriesRef.current, {}, commitLastRef.current);
      ids.forEach((id) => {
        const row = rows.find((item) => item.entry?.id === id);
        if (row?.entry && row.completed) void reestimateEntry(row.entry);
      });
    }, REESTIMATE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [commitLast, reestimateEntry, workingText]);

  // Adding a key later turns the "+ cal" placeholders back into estimates.
  useEffect(() => {
    if (!hasKey) return;
    setLineStatuses((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([, status]) => status.phase !== "needs-calories"));
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [hasKey]);

  useEffect(() => {
    if (!focusSignal) return;
    inputRef.current?.focus();
  }, [focusSignal]);

  useEffect(() => {
    const clean = sanitizePrefill(prefillText);
    if (!clean) return;
    const key = `${focusSignal}:${clean}`;
    if (lastPrefillRef.current === key) return;
    lastPrefillRef.current = key;
    // Prefilled text is never auto-submitted: it lands on the last line and waits for Enter.
    const next = workingTextRef.current.trim() ? `${workingTextRef.current.trimEnd()}\n${clean}` : clean;
    animateLayout();
    setWorkingText(next);
    setCommitLast(false);
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
    const show = Keyboard.addListener("keyboardDidShow", (event: KeyboardEvent) => {
      setKeyboardOpen(true);
      const windowHeight = Dimensions.get("window").height;
      setKeyboardHeight(Math.max(0, windowHeight - event.endCoordinates.screenY));
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardOpen(false);
      setKeyboardHeight(0);
    });
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
    if (event.error === "no-speech" || event.error === "speech-timeout") {
      showToast({ kind: "info", message: "Amy did not hear anything. Tap the mic to try again." });
    } else if (event.error !== "aborted") {
      showToast({ kind: "error", message: event.message || "Dictation stopped." });
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
      // A finished dictation is a finished line: log it without needing the keyboard's Enter.
      persistNote(selectedDay, nextText);
      setCommitLast(true);
      abortDictation();
    }
  });

  const performDaySwipe = useCallback(
    (dx: number, dy: number) => {
      if (!isDaySwipeGesture({ dx, dy })) return false;
      const now = Date.now();
      if (now - lastDaySwipeAtRef.current < 300) return true;
      lastDaySwipeAtRef.current = now;
      persistNote(selectedDay, workingTextRef.current);
      skipNextBlurSaveRef.current = true;
      Keyboard.dismiss();
      inputRef.current?.blur();
      animateLayout();
      void feedback("swipe");
      shiftDay(dx < 0 ? 1 : -1);
      return true;
    },
    [persistNote, selectedDay, shiftDay]
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
      persistNote(selectedDay, workingTextRef.current);
      if (workingTextRef.current.trim()) setCommitLast(true);
      abortDictation();
      return;
    }
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      showToast({ kind: "error", message: "Speech recognition is not available on this device." });
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      showToast({ kind: "error", message: "Microphone permission is needed for dictation." });
      return;
    }
    speechBaseTextRef.current = workingTextRef.current.trim();
    dictationRequestedRef.current = true;
    acceptingSpeechRef.current = true;
    setListening(true);
    const language = dataRef.current?.settings.dictationLanguage;
    try {
      ExpoSpeechRecognitionModule.start({
        lang: !language || language === "auto" ? deviceLocale() : language,
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        addsPunctuation: false,
        contextualStrings: ["calories", "protein", "chicken", "rice", "toast", "grams", "ounces", "sauce"]
      });
      showToast({ kind: "info", message: "Listening. Say what you ate.", durationMs: 1800 });
    } catch {
      dictationRequestedRef.current = false;
      acceptingSpeechRef.current = false;
      setListening(false);
      showToast({ kind: "error", message: "Dictation could not start on this device." });
    }
  }, [abortDictation, listening, persistNote, selectedDay, showToast]);

  useEffect(() => {
    if (!dictationSignal || lastDictationSignalRef.current === dictationSignal) return;
    lastDictationSignalRef.current = dictationSignal;
    inputRef.current?.focus();
    const timer = setTimeout(() => {
      void toggleDictation();
    }, 220);
    return () => clearTimeout(timer);
  }, [dictationSignal, toggleDictation]);

  const handleTextChange = (value: string) => {
    const previous = workingTextRef.current;
    animateLayout();

    // Fixing a typo keeps the logged entry (and any numbers the user corrected) attached to the line.
    const edit = singleLineEdit(previous, value);
    if (edit) {
      const entry = buildLineRows(previous, entriesRef.current, {})[edit.index]?.entry;
      if (entry) {
        const rawInput = edit.after.trim();
        updateEntry(entry.id, { rawInput });
        entriesRef.current = entriesRef.current.map((item) => (item.id === entry.id ? { ...item, rawInput } : item));
        if (!entry.userEdited && entry.source === "ai_text") pendingReestimateRef.current.set(entry.id, Date.now());
      }
    }

    // Only entries that had a line a moment ago and lost it are removed, and that is undoable.
    const alreadyOrphaned = new Set(entriesWithoutLines(previous, entriesRef.current).map((entry) => entry.id));
    const removed = entriesWithoutLines(value, entriesRef.current).filter((entry) => !alreadyOrphaned.has(entry.id));
    if (removed.length) {
      removed.forEach((entry) => {
        pendingReestimateRef.current.delete(entry.id);
        deleteEntry(entry.id);
      });
      entriesRef.current = entriesRef.current.filter((entry) => !removed.some((item) => item.id === entry.id));
      const removedCalories = removed.reduce((sum, entry) => sum + entry.macros.calories, 0);
      showToast({
        kind: "info",
        message: removed.length === 1 ? `Removed ${removed[0]?.title ?? "food"} (${removedCalories.toLocaleString()} cal)` : `Removed ${removed.length} foods (${removedCalories.toLocaleString()} cal)`,
        actionLabel: "Undo",
        onAction: () => {
          removed.forEach((entry) => restoreEntry(entry, previous.trimEnd()));
          externalNoteRef.current = previous.trimEnd();
          setWorkingText(previous);
        }
      });
    }

    setWorkingText(value);
    setCommitLast(false);
    if (calorieOverlayVisible) setCalorieOverlayVisible(false);
  };

  const replaceLineForEntry = (entry: FoodEntry, replacement: string | null) => {
    const rows = buildLineRows(workingTextRef.current, entriesRef.current, {});
    const index = rows.find((row) => row.entry?.id === entry.id)?.index;
    if (index === undefined) return workingTextRef.current;
    const lines = rows.map((row) => row.text);
    if (replacement === null) lines.splice(index, 1);
    else lines[index] = replacement.replace(/[\r\n]+/g, " ");
    const next = lines.join("\n");
    animateLayout();
    setWorkingText(next);
    persistNote(selectedDay, next);
    return next;
  };

  const saveEntry = (entry: FoodEntry, patch: Partial<FoodEntry>) => {
    const titleChanged = typeof patch.title === "string" && patch.title.trim() && patch.title !== entry.title;
    const rawInput = titleChanged ? (patch.title ?? entry.title) : (entry.rawInput ?? entry.title);
    updateEntry(entry.id, titleChanged ? { ...patch, rawInput } : patch);
    if (titleChanged) replaceLineForEntry(entry, rawInput);
    const merged = { ...entry, ...patch };
    // Confirmed numbers are remembered, so typing this line again is instant and consistent.
    if (patch.userEdited) rememberFood(rawInput, merged);
    setEditingEntryId(null);
    showToast({ kind: "success", message: patch.userEdited ? `Saved. Amy will reuse this for "${rawInput.trim()}".` : "Food updated." });
  };

  const removeEntry = (entry: FoodEntry) => {
    const previousText = workingTextRef.current;
    deleteEntry(entry.id);
    replaceLineForEntry(entry, null);
    setEditingEntryId(null);
    showToast({
      kind: "info",
      message: `Removed ${entry.title}`,
      actionLabel: "Undo",
      onAction: () => {
        restoreEntry(entry, previousText.trimEnd());
        externalNoteRef.current = previousText.trimEnd();
        setWorkingText(previousText);
      }
    });
  };

  const createManualEntry = (line: string, fields: FoodFields) => {
    const text = line.trim();
    addEntryFromDraft(draftFromParts(fields, text, selectedDay, "manual", { confidence: 1, sourceLabel: "Manual" }), text, { appendNoteLine: false });
    rememberFood(text, fields);
    if (manualLine) setStatus(manualLine.key, null);
    setManualLine(null);
    void feedback("log");
    showToast({ kind: "success", message: `Logged ${fields.macros.calories.toLocaleString()} cal. Amy will remember "${text}".` });
  };

  const saveAsMeal = (fields: FoodFields) => {
    addSavedMeal({ title: fields.title, servingLabel: fields.servingLabel, macros: fields.macros, portion: fields.portion });
    showToast({ kind: "success", message: `"${fields.title}" added to saved meals.` });
  };

  const retryLine = (row: LineRow) => {
    setStatus(row.key, null);
    setRetryTick((tick) => tick + 1);
  };

  if (!data) return null;

  const calorieProgress = data.goal.dailyCalories > 0 ? totals.calories / data.goal.dailyCalories : 0;
  const remaining = data.goal.dailyCalories - totals.calories;
  const onToday = selectedDay === today;
  const lastRow = lineRows[lineRows.length - 1];
  const showEnterHint = inputFocused && lastRow && !lastRow.completed && !lastRow.entry && isLoggableLine(lastRow.text);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
      onTouchStart={rememberTouchStart}
      onTouchEnd={finishTouchSwipe}
      {...panResponder.panHandlers}
    >
      <View style={[styles.top, compactChrome && styles.topCompact, { top: floatingHeaderTop }]}>
        <Image source={require("../../assets/icon-cat-alt.png")} style={[styles.logo, compactChrome && styles.logoCompact]} />
        <InteractivePressable
          accessibilityRole="button"
          accessibilityLabel={onToday ? "Today" : `${labelForDay(selectedDay)}. Jump to today`}
          accessibilityHint={onToday ? "Swipe left or right on the log to change days." : "Returns the log to today's date."}
          onPress={() => {
            if (onToday) {
              showToast({ kind: "info", message: "Swipe left or right to change days.", durationMs: 1800 });
              return;
            }
            persistNote(selectedDay, workingTextRef.current);
            goToToday();
          }}
          style={[styles.todayPill, compactChrome && styles.todayPillCompact, !onToday && styles.todayPillAway]}
        >
          <Text style={[styles.todayText, compactChrome && styles.todayTextCompact]}>{labelForDay(selectedDay)}</Text>
          {onToday ? null : <Text style={styles.todayHint}>Tap for today</Text>}
        </InteractivePressable>
        <View style={[styles.topActions, compactChrome && styles.topActionsCompact]}>
          <InteractivePressable
            accessibilityRole="button"
            accessibilityLabel={`${streakCount} day streak`}
            accessibilityHint="Opens stats and streak details."
            onPress={() => openModal("stats")}
            style={[styles.streakPill, compactChrome && styles.streakPillCompact]}
          >
            <Flame size={compactChrome ? 18 : 20} color={colors.orange} fill={colors.orange} strokeWidth={2.2} />
            <Text style={[styles.streakText, compactChrome && styles.streakTextCompact]}>{streakCount}</Text>
          </InteractivePressable>
          <InteractivePressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            accessibilityHint="Edit goals, AI settings, import, export, and app preferences."
            onPress={() => openModal("settings")}
            style={[styles.settingsPill, compactChrome && styles.settingsPillCompact]}
          >
            <Settings size={compactChrome ? 20 : 22} color={colors.ink} strokeWidth={2.5} />
          </InteractivePressable>
        </View>
      </View>

      {saveError ? (
        <View accessibilityRole="alert" style={[styles.saveBanner, { top: floatingHeaderTop + FLOATING_HEADER_HEIGHT + 8 }]}>
          <Text style={styles.saveBannerText}>{saveError}</Text>
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.logArea}>
          <View style={styles.noteColumn}>
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
                else {
                  persistNote(selectedDay, workingTextRef.current);
                  // Leaving the editor finishes the line being typed, so it is never silently unlogged.
                  if (workingTextRef.current.trim()) setCommitLast(true);
                }
                if (dockBlurTimerRef.current) clearTimeout(dockBlurTimerRef.current);
                dockBlurTimerRef.current = setTimeout(() => setInputFocused(false), 180);
              }}
              multiline
              scrollEnabled
              onScroll={(event) => setNoteScrollY(event.nativeEvent.contentOffset.y)}
              placeholder={hasKey ? "Start logging your meals...\nOne food per line, then Enter." : "Start logging your meals...\nTry: protein shake 160 cal"}
              placeholderTextColor={colors.dim}
              accessibilityLabel={`Food log for ${labelForDay(selectedDay)}`}
              style={[styles.noteInput, { paddingTop: contentTopInset, paddingBottom: dockReserve }]}
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
          </View>

          <View style={styles.lineRailViewport}>
            <View style={[styles.lineRailClip, { marginTop: contentTopInset, marginBottom: dockReserve }]}>
              <View style={[styles.lineRail, { transform: [{ translateY: -noteScrollY }] }]}>
                {lineRows.map((row) => {
                  const rowHeight = lineHeights[row.key] ?? NOTE_LINE_HEIGHT;
                  const phase = row.status?.phase;
                  let content: React.ReactNode = null;

                  if (phase === "estimating" || phase === "searching") {
                    content = <PhaseIndicator label={activePhaseText[phase]} />;
                  } else if (row.entry) {
                    const entry = row.entry;
                    const low = isLowConfidence(entry);
                    const label = `${low ? "~" : ""}${entry.macros.calories.toLocaleString()} cal`;
                    content = (
                      <InteractivePressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${entry.title}, ${entry.macros.calories} calories${low ? ", low confidence estimate" : ""}`}
                        accessibilityHint="Opens the nutrition editor for this log line."
                        feedbackKind="edit"
                        onPress={() => setEditingEntryId(entry.id)}
                        style={styles.lineCalorieHit}
                      >
                        <Text style={[styles.sideCalories, low && styles.sideCaloriesLow]}>{label}</Text>
                      </InteractivePressable>
                    );
                  } else if (phase === "error") {
                    content = (
                      <InteractivePressable
                        accessibilityRole="button"
                        accessibilityLabel={`Estimate failed for ${row.text.trim()}. Retry`}
                        accessibilityHint={row.status?.message}
                        onPress={() => retryLine(row)}
                        onLongPress={() => setManualLine({ key: row.key, text: row.text })}
                        style={styles.lineCalorieHit}
                      >
                        <View style={[styles.lineChip, styles.lineChipError]}>
                          <Text style={[styles.lineChipText, styles.lineChipErrorText]}>Retry</Text>
                        </View>
                      </InteractivePressable>
                    );
                  } else if (phase === "needs-calories") {
                    content = (
                      <InteractivePressable
                        accessibilityRole="button"
                        accessibilityLabel={`Add calories for ${row.text.trim()}`}
                        accessibilityHint="Opens manual calorie entry for this line."
                        feedbackKind="edit"
                        onPress={() => setManualLine({ key: row.key, text: row.text })}
                        style={styles.lineCalorieHit}
                      >
                        <View style={styles.lineChip}>
                          <Text style={styles.lineChipText}>+ cal</Text>
                        </View>
                      </InteractivePressable>
                    );
                  } else if (showEnterHint && row.key === lastRow?.key) {
                    content = <Text style={styles.enterHint}>↵ to log</Text>;
                  }

                  return (
                    <View key={row.key} style={[styles.lineRailSlot, { height: rowHeight }]}>
                      {content}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </View>

      {calorieOverlayVisible ? (
        <View style={[styles.calorieOverlay, { bottom: dockBottom + 66 }]}>
          <Text style={styles.overlayTitle}>{onToday ? "Today" : labelForDay(selectedDay)}</Text>
          <View style={styles.overlayCalorieRow}>
            <View style={styles.overlayCalorieLabel}>
              <Text style={styles.overlayCalorieEmoji}>🔥</Text>
              <Text style={styles.overlayCalorieText}>Calories</Text>
            </View>
            <Text style={styles.overlayCalorieValue}>
              {totals.calories.toLocaleString()} / {data.goal.dailyCalories.toLocaleString()}
            </Text>
          </View>
          <ProgressBar value={calorieProgress} color={remaining < 0 ? colors.orange : colors.green} />
          <Text style={styles.overlayRemaining}>
            {remaining >= 0 ? `${remaining.toLocaleString()} cal left` : `${Math.abs(remaining).toLocaleString()} cal over goal`}
          </Text>
          <View style={styles.overlayRings}>
            <MacroRing label="Carbs" value={totals.carbs} target={data.goal.carbsTarget} color={colors.pink} />
            <MacroRing label="Protein" value={totals.protein} target={data.goal.proteinTarget} color={colors.blue} />
            <MacroRing label="Fat" value={totals.fat} target={data.goal.fatTarget} color={colors.yellow} />
          </View>
        </View>
      ) : null}

      <ToastViewport bottom={dockBottom + 64} />

      <View style={[styles.dock, compactChrome && styles.dockCompact, { left: dockSideInset, right: dockSideInset, bottom: dockBottom }]}>
        <InteractivePressable
          accessibilityRole="button"
          accessibilityLabel={`${totals.calories} calories logged. ${calorieOverlayVisible ? "Hide" : "Show"} details`}
          accessibilityHint="Toggles the calorie and macro summary."
          onPress={() => {
            Keyboard.dismiss();
            setCalorieOverlayVisible((visible) => !visible);
          }}
          style={[styles.caloriePill, compactChrome && styles.caloriePillCompact, calorieOverlayVisible && styles.caloriePillActive]}
        >
          <Text style={styles.calorieEmoji}>🔥</Text>
          <Text style={styles.caloriePillText}>{totals.calories.toLocaleString()}</Text>
        </InteractivePressable>
        <InteractivePressable
          accessibilityRole="button"
          accessibilityLabel={listening ? "Stop dictation" : "Start dictation"}
          accessibilityHint="Dictates a meal into the log."
          accessibilityState={{ selected: listening }}
          onPress={toggleDictation}
          style={[styles.roundButton, compactChrome && styles.roundButtonCompact, listening && styles.roundButtonOn]}
        >
          <Mic size={compactChrome ? 22 : 24} color={listening ? colors.ink : colors.blue} strokeWidth={2.6} />
        </InteractivePressable>
        <InteractivePressable
          accessibilityRole="button"
          accessibilityLabel="Open meal photo capture"
          accessibilityHint="Take or choose meal photos to estimate nutrition."
          onPress={() => openModal("capture", "photo")}
          style={[styles.roundButton, compactChrome && styles.roundButtonCompact]}
        >
          <Camera size={compactChrome ? 22 : 24} color={colors.pink} strokeWidth={2.6} />
        </InteractivePressable>
        <InteractivePressable
          accessibilityRole="button"
          accessibilityLabel="Open saved meals"
          accessibilityHint="Add a saved meal to the log."
          onPress={() => openModal("saved")}
          style={[styles.roundButton, compactChrome && styles.roundButtonCompact]}
        >
          <Plus size={compactChrome ? 24 : 26} color={colors.orange} strokeWidth={2.8} />
        </InteractivePressable>
        <InteractivePressable
          accessibilityRole="button"
          accessibilityLabel="Scan barcode"
          accessibilityHint="Scan a packaged food with Open Food Facts."
          onPress={() => openModal("capture", "barcode")}
          style={[styles.roundButton, compactChrome && styles.roundButtonCompact]}
        >
          <Barcode size={compactChrome ? 22 : 24} color={colors.ink} strokeWidth={2.4} />
        </InteractivePressable>
      </View>

      <FoodEditModal
        entry={editingEntry}
        newLine={editingEntry ? undefined : manualLine?.text}
        canReestimate={hasKey}
        onClose={() => {
          setEditingEntryId(null);
          setManualLine(null);
        }}
        onSave={saveEntry}
        onCreate={createManualEntry}
        onDelete={removeEntry}
        onReestimate={(entry) => {
          setEditingEntryId(null);
          forgetFood(entry.rawInput ?? entry.title);
          void reestimateEntry(entry, { manual: true });
        }}
        onSaveAsMeal={saveAsMeal}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    position: "relative",
    paddingHorizontal: 18,
    paddingBottom: 0
  },
  top: {
    position: "absolute",
    left: 18,
    right: 18,
    height: FLOATING_HEADER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    elevation: 20
  },
  topCompact: {
    left: 14,
    right: 14
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 12,
    position: "absolute",
    left: 0,
    top: 3
  },
  logoCompact: {
    width: 42,
    height: 42,
    top: 5
  },
  topActions: {
    position: "absolute",
    right: 0,
    top: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  topActionsCompact: {
    gap: 6
  },
  todayPill: {
    minWidth: 116,
    maxWidth: 164,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FLOATING_PANEL_BG,
    borderWidth: 1,
    borderColor: FLOATING_PANEL_LINE
  },
  todayPillCompact: {
    minWidth: 104,
    height: 44,
    paddingHorizontal: 14
  },
  todayText: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900"
  },
  todayTextCompact: {
    fontSize: 16
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
    backgroundColor: FLOATING_PANEL_BG,
    borderWidth: 1,
    borderColor: FLOATING_PANEL_LINE
  },
  streakPillCompact: {
    height: 44,
    minWidth: 62,
    paddingLeft: 14,
    paddingRight: 12
  },
  settingsPill: {
    height: 48,
    width: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FLOATING_PANEL_BG,
    borderWidth: 1,
    borderColor: FLOATING_PANEL_LINE
  },
  settingsPillCompact: {
    height: 44,
    width: 44
  },
  streakText: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "900"
  },
  streakTextCompact: {
    fontSize: 17
  },
  body: {
    flex: 1
  },
  logArea: {
    flex: 1,
    minHeight: 128,
    flexDirection: "row",
    alignItems: "stretch",
    gap: NOTE_ROW_GAP,
    overflow: "hidden"
  },
  noteColumn: {
    flex: 1,
    minWidth: 0,
    position: "relative",
    overflow: "hidden"
  },
  noteInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 24,
    lineHeight: NOTE_LINE_HEIGHT,
    fontWeight: "500",
    padding: 0,
    paddingBottom: 18,
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
  lineRailViewport: {
    width: LINE_RAIL_WIDTH,
    alignSelf: "stretch",
    overflow: "hidden"
  },
  lineRailClip: {
    flex: 1,
    overflow: "hidden"
  },
  lineRail: {
    width: LINE_RAIL_WIDTH,
    alignItems: "flex-end"
  },
  lineRailSlot: {
    width: "100%",
    alignItems: "flex-end",
    justifyContent: "flex-start"
  },
  lineCalorieHit: {
    position: "absolute",
    top: -CALORIE_HIT_OFFSET,
    right: 0,
    minWidth: 86,
    height: CALORIE_HIT_TARGET,
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
  noticeArea: {
    position: "absolute",
    left: 18,
    right: 18,
    alignItems: "center",
    zIndex: 14,
    elevation: 14
  },
  notice: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
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
  dockCompact: {
    left: 14,
    right: 14,
    gap: 6
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
    backgroundColor: FLOATING_PANEL_BG,
    borderWidth: 1,
    borderColor: FLOATING_PANEL_LINE
  },
  caloriePillCompact: {
    minWidth: 84,
    height: 50
  },
  caloriePillActive: {
    backgroundColor: FLOATING_PANEL_ACTIVE_BG,
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
    backgroundColor: FLOATING_PANEL_BG,
    borderWidth: 1,
    borderColor: FLOATING_PANEL_LINE
  },
  roundButtonCompact: {
    width: 46,
    height: 46
  },
  roundButtonOn: {
    backgroundColor: colors.purple
  },
  todayPillAway: {
    borderColor: colors.purple
  },
  todayHint: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800"
  },
  saveBanner: {
    position: "absolute",
    left: 18,
    right: 18,
    zIndex: 19,
    elevation: 19,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 51, 101, 0.16)",
    borderWidth: 1,
    borderColor: colors.pink
  },
  saveBannerText: {
    color: colors.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800"
  },
  sideCaloriesLow: {
    color: colors.orange
  },
  lineChip: {
    minWidth: 64,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: colors.purpleSoft,
    borderWidth: 1,
    borderColor: colors.purple
  },
  lineChipText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  lineChipError: {
    backgroundColor: "rgba(255, 51, 101, 0.14)",
    borderColor: colors.pink
  },
  lineChipErrorText: {
    color: colors.pink
  },
  enterHint: {
    color: colors.dim,
    fontSize: 12,
    lineHeight: NOTE_LINE_HEIGHT,
    fontWeight: "800"
  },
  overlayRemaining: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  }
});
