import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, StyleSheet, Text, View } from "react-native";
import { AlertTriangle, Check, Info } from "lucide-react-native";

import { feedback } from "../services/feedback";
import { colors } from "../theme";
import { InteractivePressable } from "./InteractivePressable";

export type ToastKind = "info" | "success" | "error";

export type ToastOptions = {
  message: string;
  kind?: ToastKind;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
};

type ActiveToast = ToastOptions & { id: number };

type ToastContextValue = {
  toast: ActiveToast | null;
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const hideToast = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  const showToast = useCallback((options: ToastOptions) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    idRef.current += 1;
    const id = idRef.current;
    setToast({ ...options, id });
    if (options.kind === "error") void feedback("error");
    AccessibilityInfo.announceForAccessibility?.(options.message);
    // Toasts with an action (Undo, Retry) stay longer so they can actually be reached.
    const duration = options.durationMs ?? (options.onAction ? 6000 : options.kind === "error" ? 5000 : 2600);
    timerRef.current = setTimeout(() => setToast((current) => (current?.id === id ? null : current)), duration);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const value = useMemo(() => ({ toast, showToast, hideToast }), [hideToast, showToast, toast]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}

/**
 * Renders the current toast. Mount one inside every surface that can cover the screen
 * (the root and each Modal), because a React Native Modal draws above root-level views.
 */
export function ToastViewport({ bottom = 24 }: { bottom?: number }) {
  const { toast, hideToast } = useToast();
  const opacity = useRef(new Animated.Value(0)).current;
  const useNativeDriver = Platform.OS !== "web";

  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver }).start();
  }, [opacity, toast, useNativeDriver]);

  if (!toast) return null;
  const kind = toast.kind ?? "info";
  const tint = kind === "error" ? colors.pink : kind === "success" ? colors.green : colors.blue;
  const Icon = kind === "error" ? AlertTriangle : kind === "success" ? Check : Info;

  return (
    <View pointerEvents="box-none" style={[styles.viewport, { bottom }]}>
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.toast, { borderColor: tint, opacity, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}
      >
        <Icon size={18} color={tint} strokeWidth={2.8} />
        <Text style={styles.message}>{toast.message}</Text>
        {toast.actionLabel && toast.onAction ? (
          <InteractivePressable
            accessibilityRole="button"
            accessibilityLabel={toast.actionLabel}
            onPress={() => {
              toast.onAction?.();
              hideToast();
            }}
            style={styles.action}
          >
            <Text style={[styles.actionText, { color: tint }]}>{toast.actionLabel}</Text>
          </InteractivePressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 60,
    elevation: 60
  },
  toast: {
    maxWidth: 520,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: "rgba(28, 28, 30, 0.97)"
  },
  message: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    paddingRight: 6
  },
  action: {
    minHeight: 40,
    minWidth: 56,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel2
  },
  actionText: {
    fontSize: 14,
    fontWeight: "900"
  }
});
