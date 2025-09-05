import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing service role client...')
    
    const supabase = createServiceRoleClient()
    
    console.log('Service role client created, testing query...')
    
    // Test basic query
    const { data, error, count } = await supabase
      .from('user_platform_automation_preferences')
      .select('regio_platform, automation_enabled', { count: 'exact' })
      .eq('automation_enabled', true)
      .limit(5)
    
    if (error) {
      console.error('Service role test error:', error)
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        details: error 
      }, { status: 500 })
    }
    
    console.log('Service role test successful:', { count, dataLength: data?.length })
    
    return NextResponse.json({
      success: true,
      message: 'Service role client working',
      enabledPlatforms: data?.length || 0,
      totalCount: count,
      sampleData: data?.slice(0, 3)
    })
    
  } catch (error) {
    console.error('Service role test exception:', error)
    return NextResponse.json({
      success: false,
      error: 'Service role test failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}