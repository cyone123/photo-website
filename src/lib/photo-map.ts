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

export function mapHref(placeId: string | null, view = 1) {
  const params = new URLSearchParams();
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
