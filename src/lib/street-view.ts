/**
 * Google Street View Static API URL construction.
 * URLs are passed through to SweetLease — no image download happens in Locust.
 */

const DEFAULT_SIZE = '600x400';
const DEFAULT_FOV = 90;
const DEFAULT_PITCH = 10;

/**
 * Build a Google Street View Static API URL from lat/lng coordinates.
 */
export function getStreetViewUrl(
  lat: number,
  lng: number,
  apiKey?: string
): string | null {
  const key = apiKey || process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const params = new URLSearchParams({
    size: DEFAULT_SIZE,
    location: `${lat},${lng}`,
    fov: String(DEFAULT_FOV),
    pitch: String(DEFAULT_PITCH),
    key,
  });

  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

/**
 * Build a Google Street View Static API URL from a text address (fallback if no lat/lng).
 */
export function getStreetViewUrlByAddress(
  address: string,
  city: string,
  state: string,
  zip: string,
  apiKey?: string
): string | null {
  const key = apiKey || process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const location = `${address}, ${city}, ${state} ${zip}`;

  const params = new URLSearchParams({
    size: DEFAULT_SIZE,
    location,
    fov: String(DEFAULT_FOV),
    pitch: String(DEFAULT_PITCH),
    key,
  });

  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}
