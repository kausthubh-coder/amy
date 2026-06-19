import * as Location from "expo-location";

export async function getLocationContext(): Promise<{ label?: string; error?: string }> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { error: "Location is off. Amy estimated without nearby restaurant context." };

    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const places = await Location.reverseGeocodeAsync(position.coords);
    const place = places[0];
    const label = [place?.city, place?.region, place?.country].filter(Boolean).join(", ");

    return {
      label: label || `${position.coords.latitude.toFixed(2)}, ${position.coords.longitude.toFixed(2)}`
    };
  } catch {
    return { error: "Amy could not read location, so the estimate skipped restaurant context." };
  }
}
