import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase-service';
import { GeocodingService } from '@/lib/geocoding-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseService.client;
    
    // Get platforms that need geocoding (no lat/lng)
    const { data: platforms, error: fetchError } = await supabase
      .from('platforms')
      .select('id, regio_platform, central_place, central_postcode')
      .is('latitude', null)
      .is('longitude', null)
      .not('central_place', 'is', null)
      .neq('central_place', '');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!platforms || platforms.length === 0) {
      return NextResponse.json({ 
        message: 'No platforms found that need geocoding',
        processed: 0 
      });
    }

    let processed = 0;
    let errors: string[] = [];

    for (const platform of platforms) {
      try {
        const geocodingResult = await GeocodingService.geocodePlatform(
          platform.central_place, 
          platform.central_postcode
        );
        
        if (geocodingResult) {
          // Update platform with geocoding results
          const { error: updateError } = await supabase
            .from('platforms')
            .update({
              latitude: geocodingResult.latitude,
              longitude: geocodingResult.longitude,
              geocoded_at: new Date().toISOString()
            })
            .eq('id', platform.id);

          if (updateError) {
            errors.push(`Failed to update platform ${platform.id}: ${updateError.message}`);
          } else {
            processed++;
            console.log(`Geocoded platform ${platform.regio_platform} (${platform.central_place}): ${geocodingResult.latitude}, ${geocodingResult.longitude}`);
          }
        } else {
          errors.push(`Could not geocode platform ${platform.regio_platform} with address: ${platform.central_place}, ${platform.central_postcode || 'no postcode'}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Error geocoding platform ${platform.id}: ${errorMsg}`);
      }
    }

    return NextResponse.json({
      message: `Processed ${processed} platforms`,
      processed,
      total: platforms.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Platform batch geocoding error:', error);
    return NextResponse.json(
      { error: 'Failed to process platform batch geocoding' }, 
      { status: 500 }
    );
  }
}