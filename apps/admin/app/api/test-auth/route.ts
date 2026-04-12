import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  try {
    console.log('Testing authentication setup...')

    // This will throw an error if user is not authenticated
    const { supabase, user } = await getAuthenticatedClient(req)

    console.log(`✅ User authenticated: ${user.email}`)

    // Test basic connection with authenticated user
    const { data: testData, error: testError } = await supabase
      .from('companies')
      .select('count', { count: 'exact', head: true })

    if (testError) {
      console.error('❌ Companies query failed:', testError)
      return NextResponse.json({
        success: false,
        error: 'Database query failed',
        details: testError.message
      }, { status: 500 })
    }

    console.log('✅ Database connection successful')

    // Test contacts query
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, name, email, company_id')
      .limit(5)

    if (contactsError) {
      console.error('❌ Contacts query failed:', contactsError)
      return NextResponse.json({
        success: false,
        error: 'Contacts query failed',
        details: contactsError.message
      }, { status: 500 })
    }

    console.log(`✅ Found ${contacts?.length || 0} contacts`)

    return NextResponse.json({
      success: true,
      message: 'Authentication setup is working correctly',
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      data: {
        connectionTest: 'passed',
        companiesCount: testData,
        contactsFound: contacts?.length || 0,
        sampleContacts: contacts?.slice(0, 2) || []
      }
    })

  } catch (error) {
    console.error('❌ Authentication test failed:', error)

    // Handle authentication errors specifically
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required',
        message: 'Please log in to access this endpoint',
        code: 'UNAUTHORIZED'
      }, { status: 401 })
    }

    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 