/**
 * Parses a number the way people type it: "1,200" and "1.200" are twelve hundred, "12,5" and
 * "12.5" are twelve and a half. Returns undefined for anything that is not a number.
 */
export function parseUserNumber(value: string): number | undefined {
  const text = value.replace(/\s/g, "");
  if (!text) return undefined;
  let normalized: string;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) normalized = text.replace(/,/g, "");
  else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) normalized = text.replace(/\./g, "").replace(",", ".");
  else normalized = text.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** ISO timestamps and YYYY-MM-DD keys sort correctly as plain strings; this avoids locale-aware compares. */
export function compareIso(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}
