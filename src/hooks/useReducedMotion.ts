import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// Android's "Remove animations" setting (and iOS "Reduce Motion"). Decorative motion is skipped when it is on.
let current = false;

function subscribe(update: (value: boolean) => void) {
  AccessibilityInfo.isReduceMotionEnabled()
    .then(update)
    .catch(() => undefined);
  const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", update);
  return () => subscription.remove();
}

subscribe((value) => {
  current = value;
});

/** For code outside React, such as layout animations. */
export function prefersReducedMotion() {
  return current;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(current);
  useEffect(() => subscribe(setReduced), []);
  return reduced;
}
