import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { photos, photoPlaces } from "@/db/schema";
import { isPhotoLocationEnabled, waitForLocationRateLimit } from "./photo-location";

const cityResponse = z.object({
  osm_type: z.enum(["node", "way", "relation"]),
  osm_id: z.number(),
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  name: z.string().optional(),
  address: z.object({
    country_code: z.string().min(2),
    state: z.string().optional(),
    city: z.string().optional(),
    town: z.string().optional(),
    municipality: z.string().optional(),
    county: z.string().optional(),
    village: z.string().optional(),
  }),
});

// Cache identical coordinates only: rounding can assign border photos to the wrong city.
const pendingPlaces = new Map<string, Promise<string | null>>();

async function lookupPlace(latitude: number, longitude: number): Promise<string | null> {
  await waitForLocationRateLimit();
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: "jsonv2",
    zoom: "10",
    addressdetails: "1",
    "accept-language": "zh-CN,en",
  }).toString();
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "photo-website/0.1 (photo metadata importer)",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`地点解析失败 (${response.status})`);
  const parsed = cityResponse.safeParse(await response.json());
  if (!parsed.success) return null;
  const value = parsed.data;
  const address = value.address;
  const name =
    value.name?.trim() ||
    address.city ||
    address.town ||
    address.municipality ||
    address.county ||
    address.village;
  if (!name) return null;
  const [place] = await getDb()
    .insert(photoPlaces)
    .values({
      name,
      countryCode: address.country_code.toUpperCase(),
      region: address.state ?? null,
      latitude: String(value.lat),
      longitude: String(value.lon),
      source: "openstreetmap",
      sourceKey: `${value.osm_type}/${value.osm_id}`,
    })
    .onConflictDoUpdate({
      target: [photoPlaces.source, photoPlaces.sourceKey],
      set: { name, region: address.state ?? null },
    })
    .returning({ id: photoPlaces.id });
  return place.id;
}

export async function assignPhotoPlace(photo: {
  id: string;
  placeId: string | null;
  latitude: string | null;
  longitude: string | null;
}) {
  if (
    photo.placeId ||
    !isPhotoLocationEnabled() ||
    photo.latitude === null ||
    photo.longitude === null
  )
    return false;
  const latitude = Number(photo.latitude);
  const longitude = Number(photo.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return false;
  const key = `${latitude},${longitude}`;
  let pending = pendingPlaces.get(key);
  if (!pending) {
    pending = lookupPlace(latitude, longitude);
    pendingPlaces.set(key, pending);
    // Bound a long-running import's memory usage.
    if (pendingPlaces.size > 1000) pendingPlaces.delete(pendingPlaces.keys().next().value!);
  }
  let placeId: string | null;
  try {
    placeId = await pending;
  } catch (error) {
    pendingPlaces.delete(key);
    throw error;
  }
  if (!placeId) {
    pendingPlaces.delete(key);
    return false;
  }
  const updated = await getDb()
    .update(photos)
    .set({ placeId, updatedAt: new Date() })
    .where(and(eq(photos.id, photo.id), isNull(photos.placeId)))
    .returning({ id: photos.id });
  return updated.length > 0;
}
