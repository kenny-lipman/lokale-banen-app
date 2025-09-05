interface GeocodingResult {
  latitude: number;
  longitude: number;
  display_name: string;
  geocoding_source: string;
}

interface PostcodeResult {
  platform_id: string;
  platform_name: string;
  match_method: string;
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
}