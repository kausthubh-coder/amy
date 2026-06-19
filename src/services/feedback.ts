import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

export type FeedbackKind = "tap" | "success" | "warning" | "error" | "swipe" | "log" | "edit" | "delete" | "keyboard";

async function playTapSound() {
  if (Platform.OS === "web") {
    const AudioContextCtor =
      globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    gain.gain.value = 0.025;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
    osc.stop(ctx.currentTime + 0.07);
  }
}

export async function feedback(kind: FeedbackKind = "tap") {
  try {
    if (Platform.OS === "android") {
      const androidKind =
        kind === "success" || kind === "log"
          ? Haptics.AndroidHaptics.Confirm
          : kind === "error" || kind === "warning" || kind === "delete"
            ? Haptics.AndroidHaptics.Reject
            : kind === "swipe"
              ? Haptics.AndroidHaptics.Gesture_End
              : kind === "edit"
                ? Haptics.AndroidHaptics.Toggle_On
                : kind === "keyboard"
                  ? Haptics.AndroidHaptics.Keyboard_Tap
            : Haptics.AndroidHaptics.Context_Click;
      await Haptics.performAndroidHapticsAsync(androidKind);
    } else if (kind === "success" || kind === "log") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (kind === "error" || kind === "delete") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (kind === "warning") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (kind === "swipe") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    } else if (kind === "edit") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (kind === "keyboard") {
      await Haptics.selectionAsync();
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // Haptics are best-effort across web, emulator, and low-power Android states.
  }

  try {
    await playTapSound();
  } catch {
    // Sound effects should never block the tracking flow.
  }
}
