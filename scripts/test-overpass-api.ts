/**
 * Test script for Overpass API business name lookup
 * Run with: npx tsx scripts/test-overpass-api.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables FIRST
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  // Dynamic import AFTER env vars are loaded
  const { GeocodingService } = await import('../lib/geocoding-service')

  console.log('🧪 Testing Overpass API business name lookup\n')

  // Test cases: bedrijven uit onze database zonder locatie data
  const testCases = [
    'de Bibliotheek aan de Vliet',
    'logopediegroenehart',
    'uniquebedrijfskleding',
    'Niersman Bouw',
    'LDL Laundry BV',
    'AEY Westland',
    'Cyclus N.V.',
    'Optimum Advocaten',
    'Practica foundation',
    'Spekvers & Voordeel Tuincentrum',
  ]

  for (const companyName of testCases) {
    console.log(`\n🔍 Testing: "${companyName}"`)
    console.log('─'.repeat(50))

    try {
      const result = await GeocodingService.geocodeBusinessName(companyName)

      if (result) {
        console.log(`✅ Found!`)
        console.log(`   Business: ${result.businessName}`)
        console.log(`   Postcode: ${result.postcode || 'N/A'}`)
        console.log(`   City: ${result.city || 'N/A'}`)
        console.log(`   Address: ${result.fullAddress || 'N/A'}`)
        console.log(`   Coords: ${result.latitude}, ${result.longitude}`)
      } else {
        console.log(`❌ Not found in OpenStreetMap`)
      }
    } catch (error) {
      console.error(`❌ Error:`, error)
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log('\n✅ Test completed!')
}

main().catch(console.error)
