import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import { GeocodingService } from '@/lib/geocoding-service';

interface RecommendationResult {
  recommended_platform: {
    id: string;
    regio_platform: string;
    central_place: string;
    central_postcode?: string;
    distance_km?: number;
    match_method: 'geocoding' | 'postcode_fallback' | 'extracted_postcode';
  } | null;
  company_location: {
    raw_address: string;
    latitude?: number;
    longitude?: number;
    postal_code?: string;
  };
  fallback_used?: boolean;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const supabase = createServiceRoleClient();
    const { companyId } = await params;

    // Get company details
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, raw_address, latitude, longitude, postal_code, geocoding_source')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const result: RecommendationResult = {
      recommended_platform: null,
      company_location: {
        raw_address: company.raw_address,
        latitude: company.latitude,
        longitude: company.longitude,
        postal_code: company.postal_code
      }
    };

    // Strategy 1: Use geocoded coordinates if available
    if (company.latitude && company.longitude) {
      const recommendedPlatform = await findClosestPlatformByCoordinates(
        supabase, 
        company.latitude, 
        company.longitude
      );
      
      if (recommendedPlatform) {
        result.recommended_platform = {
          ...recommendedPlatform,
          match_method: 'geocoding'
        };
        return NextResponse.json(result);
      }
    }

    // Strategy 2: Try postal_code from companies table
    if (company.postal_code) {
      // Extract 4 digits from the postal_code
      const fourDigitPostcode = company.postal_code.match(/\d{4}/)?.[0];
      if (fourDigitPostcode) {
        const platformByPostcode = await findPlatformByPostcode(supabase, fourDigitPostcode);
        if (platformByPostcode) {
          result.recommended_platform = {
            ...platformByPostcode,
            match_method: 'postcode_fallback'
          };
          result.fallback_used = true;
          return NextResponse.json(result);
        }
      }
    }

    // Strategy 3: Extract postcode from raw_address
    if (company.raw_address) {
      const extractedPostcode = GeocodingService.extractPostcode(company.raw_address);
      if (extractedPostcode) {
        const platformByExtractedPostcode = await findPlatformByPostcode(supabase, extractedPostcode);
        if (platformByExtractedPostcode) {
          result.recommended_platform = {
            ...platformByExtractedPostcode,
            match_method: 'extracted_postcode'
          };
          result.fallback_used = true;
          return NextResponse.json(result);
        }
      }
    }

    // No recommendation found
    return NextResponse.json(result);

  } catch (error) {
    console.error('Platform recommendation error:', error);
    return NextResponse.json(
      { error: 'Failed to get platform recommendation' },
      { status: 500 }
    );
  }
}

async function findClosestPlatformByCoordinates(
  supabase: any,
  companyLat: number,
  companyLng: number
) {
  // Get all platforms with coordinates
  const { data: platforms, error } = await supabase
    .from('platforms')
    .select('id, regio_platform, central_place, central_postcode, latitude, longitude')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .eq('is_active', true);

  if (error || !platforms || platforms.length === 0) {
    return null;
  }

  let closestPlatform = null;
  let minDistance = Infinity;

  for (const platform of platforms) {
    const distance = GeocodingService.calculateDistance(
      companyLat,
      companyLng,
      platform.latitude,
      platform.longitude
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestPlatform = {
        ...platform,
        distance_km: Math.round(distance * 10) / 10 // Round to 1 decimal
      };
    }
  }

  return closestPlatform;
}

async function findPlatformByPostcode(supabase: any, postcode: string) {
  // First get the city to find platform_id
  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('platform_id')
    .eq('postcode', postcode)
    .eq('is_active', true)
    .single();

  if (cityError || !city || !city.platform_id) {
    return null;
  }

  // Then get the platform details
  const { data: platforms, error: platformError } = await supabase
    .from('platforms')
    .select('id, regio_platform, central_place, central_postcode')
    .eq('id', city.platform_id);

  const platform = platforms && platforms.length > 0 ? platforms[0] : null;

  if (platformError || !platform) {
    return null;
  }

  return platform;
}