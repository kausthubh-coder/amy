import * as Clipboard from "expo-clipboard";
import React, { Component, ReactNode, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { readRawStorage } from "../storage/localDataStore";
import { colors } from "../theme";
import { InteractivePressable } from "./InteractivePressable";

/**
 * Shown when saved data cannot be read or the UI crashed. Nothing is overwritten from here
 * without an explicit second tap, and the raw data can always be copied out first.
 */
export function RecoveryScreen({
  title,
  detail,
  onRetry,
  onStartFresh
}: {
  title: string;
  detail: string;
  onRetry: () => void;
  onStartFresh?: () => Promise<void>;
}) {
  const [status, setStatus] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const copyRaw = async () => {
    try {
      await Clipboard.setStringAsync(await readRawStorage());
      setStatus("Raw data copied. Paste it somewhere safe (notes, email) before doing anything else.");
    } catch {
      setStatus("Amy could not read the raw data either. Try restarting your phone, then open Amy again.");
    }
  };

  const reset = async () => {
    if (!onStartFresh) return;
    if (!confirmReset) {
      setConfirmReset(true);
      setStatus("Tap again to start a new diary. The damaged data is moved aside on this device, not deleted.");
      return;
    }
    try {
      await onStartFresh();
    } catch {
      setStatus("Starting fresh failed. Free up device storage and try again.");
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.detail}>{detail}</Text>
      <View style={styles.actions}>
        <InteractivePressable accessibilityRole="button" onPress={onRetry} style={[styles.button, styles.primary]}>
          <Text style={styles.primaryText}>Try again</Text>
        </InteractivePressable>
        <InteractivePressable accessibilityRole="button" onPress={copyRaw} style={styles.button}>
          <Text style={styles.buttonText}>Copy my raw data</Text>
        </InteractivePressable>
        {onStartFresh ? (
          <InteractivePressable accessibilityRole="button" feedbackKind="warning" onPress={reset} style={[styles.button, confirmReset && styles.danger]}>
            <Text style={[styles.buttonText, confirmReset && styles.dangerText]}>{confirmReset ? "Yes, start a new diary" : "Start fresh"}</Text>
          </InteractivePressable>
        ) : null}
      </View>
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </ScrollView>
  );
}

type BoundaryState = { error: Error | null; attempt: number };

export class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <RecoveryScreen
          title="Amy hit a problem"
          detail={`Your diary is still saved on this device. You can retry, or copy the raw data as a backup.\n\n${this.state.error.message}`}
          onRetry={() => this.setState((state) => ({ error: null, attempt: state.attempt + 1 }))}
        />
      );
    }
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 28,
    gap: 16
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900"
  },
  detail: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700"
  },
  actions: {
    gap: 10,
    marginTop: 8
  },
  button: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  primary: {
    backgroundColor: colors.purple,
    borderColor: colors.purple
  },
  danger: {
    borderColor: colors.pink
  },
  buttonText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  primaryText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  dangerText: {
    color: colors.pink
  },
  status: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700"
  }
});
