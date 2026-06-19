import React, { ReactNode, useRef } from "react";
import { Animated, GestureResponderEvent, Platform, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";

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
  const useNativeDriver = Platform.OS !== "web";

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.965, useNativeDriver, speed: 34, bounciness: 6 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver, speed: 26, bounciness: 8 }).start();
  };

  const handlePress = async (event: GestureResponderEvent) => {
    if (!disabled) await feedback(sound ? feedbackKind : "tap");
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
