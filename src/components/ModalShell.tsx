import React, { ReactNode } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";

import { colors } from "../theme";
import { InteractivePressable } from "./InteractivePressable";

export function ModalShell({
  visible,
  title,
  children,
  onClose
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <InteractivePressable accessibilityLabel={`Close ${title}`} onPress={onClose} style={styles.close}>
              <X size={28} color={colors.muted} strokeWidth={2.4} />
            </InteractivePressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
        </View>
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
  title: {
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
