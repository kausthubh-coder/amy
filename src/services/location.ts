import * as Location from "expo-location";

export type LocationContext = {
  label?: string;
  countryCode?: string;
  error?: string;
};

const CACHE_MS = 15 * 60 * 1000;
// A failed fix is remembered briefly too, so a run of lines does not wait out the timeout each time.
const FAILURE_CACHE_MS = 2 * 60 * 1000;
const FIX_TIMEOUT_MS = 6000;
let cached: { at: number; value: LocationContext } | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

/**
 * Rough, city-level context for restaurant estimates. Coordinates never reach OpenRouter: only the
 * neighborhood/city/region/country label and country code leave this function. Turning the fix into
 * a place name goes through Android's geocoder, which is Google's on phones with Play services.
 * Results are cached so logging several lines does not wake the GPS for each one.
 */
export async function getLocationContext(options: { fresh?: boolean } = {}): Promise<LocationContext> {
  if (!options.fresh && cached && Date.now() - cached.at < (cached.value.error ? FAILURE_CACHE_MS : CACHE_MS)) return cached.value;
  const value = await readLocationContext();
  cached = { at: Date.now(), value };
  return value;
}

async function readLocationContext(): Promise<LocationContext> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { error: "Location is off, so estimates skip nearby restaurant context." };

    const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 }).catch(() => null);
    const position = lastKnown ?? (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }), FIX_TIMEOUT_MS));
    if (!position) return { error: "Amy could not get a location fix, so this estimate skipped restaurant context." };

    const places = await Location.reverseGeocodeAsync(position.coords).catch(() => []);
    const place = places[0];
    const parts = [place?.district, place?.city ?? place?.subregion, place?.region, place?.country].filter(
      (part, index, all): part is string => Boolean(part) && all.indexOf(part) === index
    );
    const value: LocationContext = {
      label: parts.join(", ") || undefined,
      countryCode: place?.isoCountryCode ?? undefined
    };
    if (!value.label) return { error: "Amy could not name this area, so the estimate skipped restaurant context." };
    return value;
  } catch {
    return { error: "Amy could not read location, so the estimate skipped restaurant context." };
  }
}

export function clearLocationCache() {
  cached = null;
}
