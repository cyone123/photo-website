import { readServerEnv } from "@/config/env";
import type { InspectedPhotoBuffer } from "./inspect-photo";

export interface PhotoLocation {
  city: string | null;
  district: string | null;
}

export function embeddedPhotoLocation(photo: InspectedPhotoBuffer): PhotoLocation {
  return {
    city: photo.locationCity,
    district: photo.locationDistrict,
  };
}

export function hasPhotoCoordinates(photo: InspectedPhotoBuffer) {
  return (
    photo.latitude !== null &&
    photo.longitude !== null &&
    Number.isFinite(photo.latitude) &&
    Number.isFinite(photo.longitude)
  );
}

export function isPhotoLocationEnabled() {
  return readServerEnv().PHOTO_LOCATION_ENABLED;
}

type JsonRecord = Record<string, unknown>;

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_USER_AGENT = "photo-website/0.1 (photo metadata importer)";
const MIN_REQUEST_INTERVAL_MS = 1100;

let lastRequestAt = 0;
let rateLimitTail = Promise.resolve();
const locationCache = new Map<string, Promise<PhotoLocation>>();

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || null;
}

function firstText(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = text(record[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function withoutDuplicate(value: string | null, other: string | null) {
  return value && value !== other ? value : null;
}

function locationFromAddress(address: JsonRecord): PhotoLocation {
  const city = firstText(address, ["city", "town", "municipality", "county", "village"]);
  const district = withoutDuplicate(
    firstText(address, [
      "city_district",
      "district",
      "county",
      "borough",
      "suburb",
      "town",
      "quarter",
    ]),
    city,
  );

  return { city, district };
}

async function waitForRateLimit() {
  const current = rateLimitTail.then(async () => {
    const waitMs = Math.max(0, lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now());

    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    lastRequestAt = Date.now();
  });

  rateLimitTail = current.catch(() => undefined);
  await current;
}

async function fetchLocation(latitude: number, longitude: number): Promise<PhotoLocation> {
  await waitForRateLimit();

  const url = new URL(NOMINATIM_REVERSE_URL);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");
  url.searchParams.set("accept-language", "zh-CN,en");

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": NOMINATIM_USER_AGENT,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return { city: null, district: null };
    }

    const payload: unknown = await response.json();
    const address = isRecord(payload) && isRecord(payload.address) ? payload.address : null;
    return address ? locationFromAddress(address) : { city: null, district: null };
  } catch {
    // Location enrichment is optional; a failed geocoder must not fail photo processing.
    return { city: null, district: null };
  }
}

export function reverseGeocodePhotoLocation(
  latitude: number | null,
  longitude: number | null,
): Promise<PhotoLocation> {
  if (!isPhotoLocationEnabled()) {
    return Promise.resolve({ city: null, district: null });
  }

  if (
    latitude === null ||
    longitude === null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return Promise.resolve({ city: null, district: null });
  }

  const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const cached = locationCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const request = fetchLocation(latitude, longitude);
  locationCache.set(cacheKey, request);
  return request;
}

export async function resolvePhotoLocation(photo: InspectedPhotoBuffer): Promise<PhotoLocation> {
  const embedded = embeddedPhotoLocation(photo);

  if (!isPhotoLocationEnabled()) {
    return embedded;
  }

  if (embedded.city && embedded.district) {
    return embedded;
  }

  const geocoded = await reverseGeocodePhotoLocation(photo.latitude, photo.longitude);

  return {
    city: embedded.city ?? geocoded.city,
    district: embedded.district ?? geocoded.district,
  };
}
