import React, { ReactNode, useRef } from "react";
import { Animated, GestureResponderEvent, Platform, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";

import { useReducedMotion } from "../hooks/useReducedMotion";
import { feedback, FeedbackKind } from "../services/feedback";

type Props = Omit<PressableProps, "style" | "children"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  feedbackKind?: FeedbackKind;
  sound?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function InteractivePressable({ children, style, onPress, feedbackKind = "tap", sound = true, disabled, ...props }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();
  const useNativeDriver = Platform.OS !== "web";

  const springTo = (toValue: number, speed: number, bounciness: number) => {
    if (reducedMotion) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, { toValue, useNativeDriver, speed, bounciness }).start();
  };
  const pressIn = () => springTo(0.965, 34, 6);
  const pressOut = () => springTo(1, 26, 8);

  const handlePress = (event: GestureResponderEvent) => {
    // Haptics are fire-and-forget so the action never waits on the vibration motor.
    if (!disabled) void feedback(sound ? feedbackKind : "tap");
    onPress?.(event);
  };

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[style, disabled && { opacity: 0.45 }, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
