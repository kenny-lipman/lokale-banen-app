import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthResult } from '@/lib/auth-middleware';
import { GeocodingService } from '@/lib/geocoding-service';

async function geocodingCompaniesHandler(request: NextRequest, authResult: AuthResult) {
  try {
    const supabase = authResult.supabase;
    
    // Get companies that need geocoding (no lat/lng and have raw_address)
    const { data: companies, error: fetchError } = await supabase
      .from('companies')
      .select('id, name, raw_address, postal_code')
      .is('latitude', null)
      .is('longitude', null)
      .not('raw_address', 'is', null)
      .neq('raw_address', '')
      .limit(50); // Process in batches to avoid timeouts

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!companies || companies.length === 0) {
      return NextResponse.json({ 
        message: 'No companies found that need geocoding',
        processed: 0 
      });
    }

    let processed = 0;
    let errors: string[] = [];

    for (const company of companies) {
      try {
        const geocodingResult = await GeocodingService.geocodeAddress(company.raw_address);
        
        if (geocodingResult) {
          // Update company with geocoding results
          const { error: updateError } = await supabase
            .from('companies')
            .update({
              latitude: geocodingResult.latitude,
              longitude: geocodingResult.longitude,
              geocoded_at: new Date().toISOString(),
              geocoding_source: geocodingResult.geocoding_source
            })
            .eq('id', company.id);

          if (updateError) {
            errors.push(`Failed to update company ${company.id}: ${updateError.message}`);
          } else {
            processed++;
            console.log(`Geocoded company ${company.name}: ${geocodingResult.latitude}, ${geocodingResult.longitude}`);
          }
        } else {
          // Try to extract postcode and store it for fallback
          const extractedPostcode = GeocodingService.extractPostcode(company.raw_address);
          if (extractedPostcode && extractedPostcode !== company.postal_code) {
            await supabase
              .from('companies')
              .update({
                postal_code: extractedPostcode,
                geocoded_at: new Date().toISOString(),
                geocoding_source: 'postcode_extracted'
              })
              .eq('id', company.id);
            
            processed++;
            console.log(`Extracted postcode for company ${company.name}: ${extractedPostcode}`);
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Error geocoding company ${company.id}: ${errorMsg}`);
      }
    }

    return NextResponse.json({
      message: `Processed ${processed} companies`,
      processed,
      total: companies.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Batch geocoding error:', error);
    return NextResponse.json(
      { error: 'Failed to process batch geocoding' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(geocodingCompaniesHandler)