/**
 * Listing quality + relevance scoring (0–100 points).
 *
 * Combines two dimensions:
 * 1. Business value — can we actually do outreach? (owner contact, portfolio)
 * 2. Tenant fit — does this match what the tenant wants? (price, bedrooms, amenities)
 */

export const QUALITY_THRESHOLD = 25;

interface QualityInput {
  // Business value signals
  ownerEmail: string | null;
  ownerPhone: string | null;
  ownerType: string | null;
  portfolioSize: number;
  listingPhone: string | null; // from Zillow CTA

  // Data quality
  zillowPhotos: string[];
  sqft: number | null;
  bathrooms: number | null;
  zip: string | null;
  daysOnMarket: number | null;
  latitude: number | null;
  longitude: number | null;

  // Tenant matching
  price: number;
  bedrooms: number;
  tenantBudgetMax: number;
  tenantBedrooms: number;
  tenantAmenities: string[];
  listingAmenities: string[]; // extracted from Zillow insights
  buildingName: string | null;
}

export interface QualityResult {
  score: number;
  breakdown: {
    ownerContact: number;
    portfolio: number;
    photos: number;
    priceMatch: number;
    bedroomMatch: number;
    amenityMatch: number;
    dataCompleteness: number;
    marketFreshness: number;
  };
}

// Map tenant amenity preferences to keywords that appear in Zillow data
const AMENITY_KEYWORDS: Record<string, string[]> = {
  'In-Unit Laundry': ['laundry', 'washer', 'dryer', 'w/d'],
  'Washer/Dryer Hookup': ['hookup', 'washer', 'dryer', 'w/d'],
  'Parking': ['parking', 'garage', 'carport'],
  'Gym': ['gym', 'fitness', 'exercise'],
  'Pool': ['pool', 'swimming'],
  'Pets OK': ['pet', 'dog', 'cat'],
  'Balcony': ['balcony', 'patio', 'terrace', 'deck'],
  'Dishwasher': ['dishwasher'],
  'A/C': ['air conditioning', 'a/c', 'ac', 'central air', 'hvac'],
  'EV Charging': ['ev', 'charging', 'electric vehicle'],
  'Furnished': ['furnished'],
  'Doorman': ['doorman', 'concierge', 'door'],
  'Rooftop': ['rooftop', 'roof deck', 'sky'],
  'Storage': ['storage', 'locker'],
  'Walk-in Closet': ['walk-in', 'closet'],
  'Hardwood Floors': ['hardwood', 'wood floor'],
};

/**
 * Compute quality + relevance score (0–100).
 *
 * | Criterion         | Max Pts | Logic                                              |
 * |-------------------|---------|----------------------------------------------------|
 * | Owner contact     | 25      | 25 email+phone, 15 email only, 10 phone only       |
 * | Portfolio size    | 15      | 15 if 5+, 10 if 2-4, 5 if 1, 0 if unknown          |
 * | Photos            | 10      | 10 if 3+, 5 if 1-2                                 |
 * | Price match       | 15      | 15 if within budget, scaled down as price increases |
 * | Bedroom match     | 10      | 10 exact, 5 if +1                                  |
 * | Amenity match     | 15      | proportional to matched amenities                   |
 * | Data completeness | 5       | sqft, bathrooms, zip                                |
 * | Market freshness  | 5       | older = more motivated landlord                     |
 */
export function scoreListingQuality(input: QualityInput): QualityResult {
  const breakdown = {
    ownerContact: 0,
    portfolio: 0,
    photos: 0,
    priceMatch: 0,
    bedroomMatch: 0,
    amenityMatch: 0,
    dataCompleteness: 0,
    marketFreshness: 0,
  };

  // Owner contact (25 pts) — most important for business
  const hasEmail = !!input.ownerEmail;
  const hasPhone = !!(input.ownerPhone || input.listingPhone);
  if (hasEmail && hasPhone) {
    breakdown.ownerContact = 25;
  } else if (hasEmail) {
    breakdown.ownerContact = 15;
  } else if (hasPhone) {
    breakdown.ownerContact = 10;
  }

  // Portfolio size (15 pts) — bigger portfolio = better outreach target
  if (input.portfolioSize >= 5) {
    breakdown.portfolio = 15;
  } else if (input.portfolioSize >= 2) {
    breakdown.portfolio = 10;
  } else if (input.portfolioSize === 1) {
    breakdown.portfolio = 5;
  }

  // Photos (10 pts)
  if (input.zillowPhotos.length >= 3) {
    breakdown.photos = 10;
  } else if (input.zillowPhotos.length >= 1) {
    breakdown.photos = 5;
  }

  // Price match (15 pts) — how close to tenant's budget
  if (input.price > 0 && input.tenantBudgetMax > 0) {
    const ratio = input.price / input.tenantBudgetMax;
    if (ratio <= 1.0) {
      // At or under budget — full points, bonus for being cheaper
      breakdown.priceMatch = 15;
    } else if (ratio <= 1.1) {
      // Up to 10% over — still good
      breakdown.priceMatch = 10;
    } else if (ratio <= 1.15) {
      // 10-15% over
      breakdown.priceMatch = 5;
    }
  }

  // Bedroom match (10 pts)
  if (input.bedrooms > 0 && input.tenantBedrooms > 0) {
    if (input.bedrooms === input.tenantBedrooms) {
      breakdown.bedroomMatch = 10;
    } else if (input.bedrooms === input.tenantBedrooms + 1) {
      breakdown.bedroomMatch = 5; // one extra bedroom
    }
  }

  // Amenity match (15 pts) — proportional to how many tenant amenities are found
  if (input.tenantAmenities.length > 0) {
    const allListingText = input.listingAmenities.join(' ').toLowerCase()
      + ' ' + (input.buildingName || '').toLowerCase();

    let matched = 0;
    for (const amenity of input.tenantAmenities) {
      const keywords = AMENITY_KEYWORDS[amenity] || [amenity.toLowerCase()];
      if (keywords.some(kw => allListingText.includes(kw))) {
        matched++;
      }
    }

    breakdown.amenityMatch = Math.round((matched / input.tenantAmenities.length) * 15);
  }

  // Data completeness (5 pts)
  if (input.sqft && input.sqft > 0) breakdown.dataCompleteness += 2;
  if (input.bathrooms && input.bathrooms > 0) breakdown.dataCompleteness += 2;
  if (input.zip && input.zip.length >= 5) breakdown.dataCompleteness += 1;

  // Market freshness (5 pts) — staler listings = more motivated
  if (input.daysOnMarket != null) {
    if (input.daysOnMarket >= 14) {
      breakdown.marketFreshness = 5;
    } else if (input.daysOnMarket >= 7) {
      breakdown.marketFreshness = 3;
    }
  }

  const score = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  return { score, breakdown };
}

/**
 * Extract amenity-like keywords from Zillow listing data.
 */
export function extractListingAmenities(result: {
  flexRecs?: Array<{ displayString: string }>;
  zovInsight?: { displayString: string; amenityType: string };
  buildingName?: string | null;
  statusText?: string;
}): string[] {
  const amenities: string[] = [];

  if (result.flexRecs) {
    for (const rec of result.flexRecs) {
      amenities.push(rec.displayString.toLowerCase());
    }
  }

  if (result.zovInsight) {
    amenities.push(result.zovInsight.displayString.toLowerCase());
    amenities.push(result.zovInsight.amenityType.toLowerCase());
  }

  if (result.buildingName) {
    amenities.push(result.buildingName.toLowerCase());
  }

  return amenities;
}

/**
 * Filter listings by quality threshold.
 */
export function filterByQuality<T extends { qualityScore: number }>(
  listings: T[],
  threshold = QUALITY_THRESHOLD,
): T[] {
  return listings
    .filter(l => l.qualityScore >= threshold)
    .sort((a, b) => b.qualityScore - a.qualityScore);
}
