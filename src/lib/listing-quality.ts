/**
 * Quality scoring for listings (0–100 points).
 * Listings below the threshold are filtered out before sending to SweetLease.
 */

export const QUALITY_THRESHOLD = 40;

interface QualityInput {
  ownerEmail: string | null;
  zillowPhotos: string[];
  ownerType: string | null; // 'individual', 'corporate', or null
  sqft: number | null;
  bathrooms: number | null;
  zip: string | null;
  daysOnMarket: number | null;
  latitude: number | null;
  longitude: number | null;
}

export interface QualityResult {
  score: number;
  breakdown: {
    ownerEmail: number;
    photos: number;
    ownerType: number;
    dataCompleteness: number;
    marketFreshness: number;
    streetView: number;
  };
}

/**
 * Compute a quality score (0–100) for a listing.
 *
 * | Criterion         | Max Points | Logic                                           |
 * |-------------------|------------|--------------------------------------------------|
 * | Has owner email   | 25         | Required for outreach                            |
 * | Zillow photos     | 20         | 20 if 3+, 10 if 1-2, 0 if none                  |
 * | Individual owner  | 15         | 15 individual, 5 corporate, 0 unknown            |
 * | Data completeness | 15         | 5 each: sqft, bathrooms, zip present             |
 * | Market freshness  | 15         | 15 if 7-60 days, 10 if 61-120, 5 if 120+         |
 * | Street View avail | 10         | Has lat/lng                                      |
 */
export function scoreListingQuality(input: QualityInput): QualityResult {
  const breakdown = {
    ownerEmail: 0,
    photos: 0,
    ownerType: 0,
    dataCompleteness: 0,
    marketFreshness: 0,
    streetView: 0,
  };

  // Owner email (25 pts)
  if (input.ownerEmail) {
    breakdown.ownerEmail = 25;
  }

  // Zillow photos (20 pts)
  if (input.zillowPhotos.length >= 3) {
    breakdown.photos = 20;
  } else if (input.zillowPhotos.length >= 1) {
    breakdown.photos = 10;
  }

  // Owner type (15 pts)
  if (input.ownerType === 'individual') {
    breakdown.ownerType = 15;
  } else if (input.ownerType === 'corporate') {
    breakdown.ownerType = 5;
  }

  // Data completeness (15 pts — 5 each)
  if (input.sqft && input.sqft > 0) breakdown.dataCompleteness += 5;
  if (input.bathrooms && input.bathrooms > 0) breakdown.dataCompleteness += 5;
  if (input.zip && input.zip.length >= 5) breakdown.dataCompleteness += 5;

  // Market freshness (15 pts)
  if (input.daysOnMarket != null) {
    if (input.daysOnMarket >= 7 && input.daysOnMarket <= 60) {
      breakdown.marketFreshness = 15;
    } else if (input.daysOnMarket > 60 && input.daysOnMarket <= 120) {
      breakdown.marketFreshness = 10;
    } else if (input.daysOnMarket > 120) {
      breakdown.marketFreshness = 5;
    }
  }

  // Street View availability (10 pts) — based on having lat/lng
  if (input.latitude && input.longitude && input.latitude !== 0 && input.longitude !== 0) {
    breakdown.streetView = 10;
  }

  const score = Object.values(breakdown).reduce((sum, v) => sum + v, 0);

  return { score, breakdown };
}

/**
 * Filter listings by quality threshold.
 * Returns only listings with score >= QUALITY_THRESHOLD, sorted by score descending.
 */
export function filterByQuality<T extends { qualityScore: number }>(
  listings: T[],
  threshold = QUALITY_THRESHOLD
): T[] {
  return listings
    .filter(l => l.qualityScore >= threshold)
    .sort((a, b) => b.qualityScore - a.qualityScore);
}
