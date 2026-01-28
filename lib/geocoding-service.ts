interface GeocodingResult {
  latitude: number;
  longitude: number;
  display_name: string;
  geocoding_source: string;
}

interface CityGeocodeResult {
  postcode: string | null;
  fullAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
}

interface PostcodeResult {
  platform_id: string;
  platform_name: string;
  match_method: string;
}

interface NominatimBusinessResult {
  postcode: string | null;
  fullAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  businessName: string | null;
}

export class GeocodingService {
  private static readonly NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
  private static readonly DELAY_MS = 1000; // 1 second delay between requests
  
  static async geocodeAddress(rawAddress: string): Promise<GeocodingResult | null> {
    if (!rawAddress?.trim()) {
      return null;
    }

    // Add delay to respect Nominatim rate limits
    await this.delay(this.DELAY_MS);
    
    try {
      // Always append Netherlands to improve accuracy
      const query = `${rawAddress.trim()}, Netherlands`;
      const url = `${this.NOMINATIM_BASE_URL}/search?` + new URLSearchParams({
        q: query,
        format: 'json',
        limit: '1',
        countrycodes: 'nl', // Restrict to Netherlands
        addressdetails: '1'
      });

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Lokale-Banen-Geocoding/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const results = await response.json();
      
      if (results && results.length > 0) {
        const result = results[0];
        return {
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          display_name: result.display_name,
          geocoding_source: 'nominatim'
        };
      }

      return null;
    } catch (error) {
      console.error('Geocoding error for address:', rawAddress, error);
      return null;
    }
  }

  static extractPostcode(rawAddress: string): string | null {
    if (!rawAddress) return null;
    
    // Dutch postcode pattern: 4 digits + space + 2 letters (e.g., "1234 AB")
    const postcodeMatch = rawAddress.match(/\b(\d{4})\s?[A-Z]{2}\b/i);
    return postcodeMatch ? postcodeMatch[1] : null; // Return only the 4 digits
  }

  static extractFullPostcode(rawAddress: string): string | null {
    if (!rawAddress) return null;
    
    // Dutch postcode pattern: 4 digits + space + 2 letters (e.g., "1234 AB")
    const postcodeMatch = rawAddress.match(/\b(\d{4}\s?[A-Z]{2})\b/i);
    return postcodeMatch ? postcodeMatch[1].replace(/\s/g, ' ').toUpperCase() : null;
  }

  static async geocodePlatform(centralPlace: string, centralPostcode?: string): Promise<GeocodingResult | null> {
    const address = centralPostcode ? 
      `${centralPlace}, ${centralPostcode}, Netherlands` : 
      `${centralPlace}, Netherlands`;
    
    const result = await this.geocodeAddress(address);
    if (result) {
      result.geocoding_source = 'nominatim_platform';
    }
    
    return result;
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Calculate distance between two points using Haversine formula
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Geocode a city name to get postal code and coordinates
   * Uses Nominatim API with addressdetails to extract postcode
   *
   * Strategy: Nominatim often doesn't return postcodes for city-level queries.
   * So we first try the city directly, and if no postcode is found, we search
   * for a generic address like "Markt 1, {city}" to get a representative postcode.
   */
  static async geocodeCity(cityName: string): Promise<CityGeocodeResult | null> {
    if (!cityName?.trim()) {
      return null;
    }

    // Clean the city name - remove common suffixes
    let cleanCity = cityName.trim()
      .replace(/,?\s*Netherlands$/i, '')
      .replace(/,?\s*Nederland$/i, '')
      .replace(/,?\s*NL$/i, '')
      .trim();

    if (!cleanCity) {
      return null;
    }

    // Add delay to respect Nominatim rate limits (1 request/second)
    await this.delay(this.DELAY_MS);

    try {
      // First try: direct city query
      let result = await this.nominatimSearch(`${cleanCity}, Netherlands`);

      if (result && result.postcode) {
        return result;
      }

      // Second try: search for a generic address in the city center
      // This usually returns a postcode because it's a specific location
      await this.delay(this.DELAY_MS);
      result = await this.nominatimSearch(`Markt 1, ${cleanCity}, Netherlands`);

      if (result && result.postcode) {
        console.log(`📍 Found postcode via "Markt 1" fallback for ${cleanCity}: ${result.postcode}`);
        return result;
      }

      // Third try: search for city center / centrum
      await this.delay(this.DELAY_MS);
      result = await this.nominatimSearch(`Centrum, ${cleanCity}, Netherlands`);

      if (result && result.postcode) {
        console.log(`📍 Found postcode via "Centrum" fallback for ${cleanCity}: ${result.postcode}`);
        return result;
      }

      // Fourth try: search for train station (most cities have one)
      await this.delay(this.DELAY_MS);
      result = await this.nominatimSearch(`Station, ${cleanCity}, Netherlands`);

      if (result && result.postcode) {
        console.log(`📍 Found postcode via "Station" fallback for ${cleanCity}: ${result.postcode}`);
        return result;
      }

      console.log(`No geocoding results for city: ${cityName} (tried multiple fallbacks)`);
      return null;
    } catch (error) {
      console.error('Geocoding error for city:', cityName, error);
      return null;
    }
  }

  /**
   * Internal helper to perform a single Nominatim search
   */
  private static async nominatimSearch(query: string): Promise<CityGeocodeResult | null> {
    try {
      const url = `${this.NOMINATIM_BASE_URL}/search?` + new URLSearchParams({
        q: query,
        format: 'json',
        limit: '1',
        countrycodes: 'nl',
        addressdetails: '1'
      });

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Lokale-Banen-Geocoding/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const results = await response.json();

      if (results && results.length > 0) {
        const result = results[0];
        const address = result.address || {};

        // Extract postcode from address details
        let postcode = address.postcode || null;

        // Sometimes Nominatim returns a range like "1234-5678", take the first part
        if (postcode && postcode.includes('-')) {
          postcode = postcode.split('-')[0].trim();
        }

        // Ensure Dutch postcode format (4 digits + 2 letters)
        // Extract just the 4-digit part for consistency (used for region mapping)
        if (postcode) {
          const digitMatch = postcode.match(/\d{4}/);
          if (digitMatch) {
            postcode = digitMatch[0];
          }
        }

        return {
          postcode: postcode,
          fullAddress: result.display_name,
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          city: address.city || address.town || address.village || address.municipality || null
        };
      }

      return null;
    } catch (error) {
      console.error('Nominatim search error for query:', query, error);
      return null;
    }
  }

  /**
   * Geocode a location string (from job posting) to get postal code
   * Handles various formats like "Amsterdam", "Amsterdam, Noord-Holland", etc.
   */
  static async geocodeLocation(location: string): Promise<CityGeocodeResult | null> {
    if (!location?.trim()) {
      return null;
    }

    // Extract city name from location string
    // Common formats: "Amsterdam", "Amsterdam, Noord-Holland", "1234 AB Amsterdam"
    let cityName = location.trim();

    // Remove postcode prefix if present (e.g., "1234 AB Amsterdam")
    const postcodeMatch = cityName.match(/^\d{4}\s?[A-Z]{2}\s+(.+)$/i);
    if (postcodeMatch) {
      cityName = postcodeMatch[1];
    }

    // Take first part before comma (usually the city)
    if (cityName.includes(',')) {
      cityName = cityName.split(',')[0].trim();
    }

    return this.geocodeCity(cityName);
  }

  /**
   * Geocode using street + city combination (more accurate, usually returns postcode)
   * Use this when job_postings have a street field
   */
  static async geocodeStreetCity(street: string, city: string): Promise<CityGeocodeResult | null> {
    if (!street?.trim() || !city?.trim()) {
      return null;
    }

    const cleanStreet = street.trim();
    const cleanCity = city.trim()
      .replace(/,?\s*Netherlands$/i, '')
      .replace(/,?\s*Nederland$/i, '')
      .replace(/,?\s*NL$/i, '')
      .trim();

    if (!cleanStreet || !cleanCity) {
      return null;
    }

    // Add delay to respect Nominatim rate limits
    await this.delay(this.DELAY_MS);

    const query = `${cleanStreet}, ${cleanCity}, Netherlands`;
    const result = await this.nominatimSearch(query);

    if (result && result.postcode) {
      console.log(`📍 Geocoded street+city: "${cleanStreet}, ${cleanCity}" → postcode ${result.postcode}`);
      return result;
    }

    // If street+city didn't work, fall back to just city
    console.log(`📍 Street+city geocode failed, falling back to city only: ${cleanCity}`);
    return this.geocodeCity(cleanCity);
  }

  // ============================================================================
  // NOMINATIM BUSINESS NAME SEARCH - FREE
  // ============================================================================

  /**
   * Search for a business by name using Nominatim (OpenStreetMap)
   * This is FREE and useful when we only have a company name and no address data
   *
   * Uses Nominatim's search functionality which can find POIs by name
   * Much more reliable than Overpass for business name searches
   */
  static async geocodeBusinessName(businessName: string): Promise<NominatimBusinessResult | null> {
    if (!businessName?.trim()) {
      return null;
    }

    const cleanName = businessName.trim();

    // Add delay to respect rate limits (1 request/second for Nominatim)
    await this.delay(this.DELAY_MS);

    try {
      // Search for business name in Netherlands
      const url = `${this.NOMINATIM_BASE_URL}/search?` + new URLSearchParams({
        q: `${cleanName}, Netherlands`,
        format: 'json',
        limit: '1',
        countrycodes: 'nl',
        addressdetails: '1'
      });

      console.log(`🔍 Nominatim: Searching for business "${cleanName}"...`);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Lokale-Banen-Geocoding/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const results = await response.json();

      if (!results || results.length === 0) {
        console.log(`📍 Nominatim: No results for business "${cleanName}"`);
        return null;
      }

      const result = results[0];
      const address = result.address || {};

      // Extract postcode
      let postcode = address.postcode || null;

      // Sometimes Nominatim returns a range like "1234-5678", take the first part
      if (postcode && postcode.includes('-')) {
        postcode = postcode.split('-')[0].trim();
      }

      // Extract only 4 digits from postcode
      if (postcode) {
        const digitMatch = postcode.match(/\d{4}/);
        if (digitMatch) {
          postcode = digitMatch[0];
        }
      }

      const businessResult: NominatimBusinessResult = {
        postcode,
        fullAddress: result.display_name || null,
        latitude: parseFloat(result.lat) || null,
        longitude: parseFloat(result.lon) || null,
        city: address.city || address.town || address.village || address.municipality || null,
        businessName: result.name || cleanName
      };

      if (businessResult.postcode) {
        console.log(`✅ Nominatim: Found "${businessResult.businessName}" → postcode ${businessResult.postcode}`);
      } else {
        console.log(`⚠️ Nominatim: Found "${businessResult.businessName}" but no postcode: ${businessResult.fullAddress}`);
      }

      return businessResult;

    } catch (error) {
      console.error('Nominatim business search error:', businessName, error);
      return null;
    }
  }
}