import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";

export type AgentImageInput = {
  uri: string;
  width?: number;
  height?: number;
  dataUrl?: string;
};

// Vision models downscale anyway; 1280px keeps labels readable while cutting uploads ~10x.
const MAX_EDGE = 1280;

/** Downscales and re-encodes a picked photo, returning a JPEG data URL ready for the agent. */
export async function prepareAgentImage(image: AgentImageInput): Promise<string> {
  if (Platform.OS === "web") {
    if (image.dataUrl?.startsWith("data:image/")) return image.dataUrl;
    if (image.uri.startsWith("data:image/") || /^https?:\/\//i.test(image.uri)) return image.uri;
    throw new Error("Could not read this browser image. Choose it from the gallery again.");
  }

  try {
    const context = ImageManipulator.manipulate(image.uri);
    const landscape = (image.width ?? 0) >= (image.height ?? 0);
    const longest = Math.max(image.width ?? 0, image.height ?? 0);
    if (!longest || longest > MAX_EDGE) context.resize(landscape ? { width: MAX_EDGE } : { height: MAX_EDGE });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.72, format: SaveFormat.JPEG, base64: true });
    if (saved.base64) return `data:image/jpeg;base64,${saved.base64}`;
  } catch {
    // The original file is never sent: gallery and camera files can carry EXIF location tags.
  }
  throw new Error("Amy could not prepare this photo. Take it again or choose a different one.");
}
