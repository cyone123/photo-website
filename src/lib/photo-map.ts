export const MAP_PAGE_SIZE = 24;
export const MAP_MAX_VIEW_PAGES = 20;

export interface MapPlace {
  id: string;
  name: string;
  countryCode: string;
  region: string | null;
  latitude: number;
  longitude: number;
  photoCount: number;
}

export function normalizeCountry(value: unknown) {
  const code = typeof value === "string" ? value.toUpperCase() : null;
  return code && /^[A-Z]{2}$/.test(code) ? code : null;
}

export function countryName(code: string) {
  const normalized = normalizeCountry(code);
  return normalized
    ? (new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(normalized) ?? normalized)
    : code;
}

export function mapCountries(places: MapPlace[]) {
  const counts = new Map<string, number>();
  for (const place of places) {
    const code = normalizeCountry(place.countryCode);
    if (code) counts.set(code, (counts.get(code) ?? 0) + place.photoCount);
  }
  return [...counts]
    .map(([code, photoCount]) => ({ code, name: countryName(code), photoCount }))
    .sort((a, b) => b.photoCount - a.photoCount || a.code.localeCompare(b.code));
}

export function mapHref(placeId: string | null, view = 1, country: string | null = null) {
  const params = new URLSearchParams();
  if (country) params.set("country", country);
  if (placeId) params.set("place", placeId);
  if (view > 1) params.set("view", String(view));
  return `/map${params.size ? `?${params}` : ""}`;
}

export function mapViewPages(value: string | undefined) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 ? Math.min(number, MAP_MAX_VIEW_PAGES) : 1;
}

export function placeLabel(place: MapPlace) {
  return [place.region !== place.name ? place.region : null, place.countryCode]
    .filter(Boolean)
    .join(" · ");
}
