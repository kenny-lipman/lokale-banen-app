import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // Use internal proxy instead of direct external URL
  const webhookUrl = `${req.nextUrl.origin}/api/webhooks/apollo`
  
  try {
    console.log('🧪 Testing webhook connectivity via proxy:', webhookUrl)
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Lokale-Banen-Test/1.0'
      },
      body: JSON.stringify({
        test: true,
        timestamp: new Date().toISOString(),
        message: 'Test webhook from Lokale-Banen'
      })
    })

    console.log('📥 Test response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    })

    const responseText = await response.text()
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      response: responseText,
      webhookUrl
    })
  } catch (error) {
    console.error('💥 Test webhook error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      webhookUrl
    }, { status: 500 })
  }
} 