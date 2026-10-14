import countries from "i18n-iso-countries";

// world-atlas features are keyed by ISO 3166-1 numeric codes ("250" = France);
// postcards and members store alpha-2 ("FR"). A few disputed areas have no id.
const UNKEYED_FEATURES: Record<string, string> = { Kosovo: "983" };

export function countryKeyFromAlpha2(alpha2: string): string | null {
  return countries.alpha2ToNumeric(alpha2.toUpperCase()) ?? null;
}

export function countryKeyFromFeature(f: { id?: string | number; properties?: { name?: string } | null }): string | null {
  if (f.id != null) return String(f.id);
  return UNKEYED_FEATURES[f.properties?.name ?? ""] ?? null;
}
