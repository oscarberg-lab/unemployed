import type { Place } from "./types";

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Distance to the nearest place whose radius covers the point, or null if none does. */
export function withinAnyPlace(lat: number, lon: number, places: Place[]): { place: Place; km: number } | null {
  let best: { place: Place; km: number } | null = null;
  for (const place of places) {
    const km = haversineKm(lat, lon, place.lat, place.lon);
    if (km <= place.radiusKm && (!best || km < best.km)) best = { place, km };
  }
  return best;
}

/** Look up a Swedish place name with OpenStreetMap Nominatim. Called once when a place is added. */
export async function geocodeSweden(query: string): Promise<{ name: string; lat: number; lon: number } | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "se");
  const res = await fetch(url, { headers: { "User-Agent": "personal-job-search-tool" } });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const hits = (await res.json()) as { lat: string; lon: string; name?: string; display_name: string }[];
  if (!hits.length) return null;
  const hit = hits[0];
  return { name: hit.name || hit.display_name.split(",")[0], lat: Number(hit.lat), lon: Number(hit.lon) };
}
