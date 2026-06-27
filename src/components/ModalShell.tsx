import React, { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme";
import { InteractivePressable } from "./InteractivePressable";

export function ModalShell({
  visible,
  title,
  titleIcon,
  headerContent,
  children,
  onClose
}: {
  visible: boolean;
  title?: string;
  titleIcon?: ReactNode;
  headerContent?: ReactNode;
  children: ReactNode;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const closeLabel = title ? `Close ${title}` : "Close";
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.avoider}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={styles.handle} />
          <View style={[styles.header, !title && !headerContent && styles.headerNoTitle]}>
            {headerContent ? (
              <View style={styles.headerCustom}>{headerContent}</View>
            ) : title ? (
              <View style={styles.headerTitle}>
                {titleIcon ? <View style={styles.titleIcon}>{titleIcon}</View> : null}
                <Text style={styles.title}>{title}</Text>
              </View>
            ) : null}
            <InteractivePressable accessibilityLabel={closeLabel} onPress={onClose} style={styles.close}>
              <X size={28} color={colors.muted} strokeWidth={2.4} />
            </InteractivePressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.55)"
  },
  avoider: {
    width: "100%",
    justifyContent: "flex-end"
  },
  sheet: {
    maxHeight: "94%",
    minHeight: "58%",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    backgroundColor: colors.bg2,
    paddingHorizontal: 22,
    paddingTop: 10
  },
  handle: {
    alignSelf: "center",
    width: 76,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.line,
    marginBottom: 18
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14
  },
  headerNoTitle: {
    justifyContent: "flex-end",
    marginBottom: 4
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingRight: 12
  },
  headerCustom: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12
  },
  titleIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  title: {
    flex: 1,
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0
  },
  close: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line
  },
  content: {
    paddingBottom: 38,
    gap: 18
  }
});
