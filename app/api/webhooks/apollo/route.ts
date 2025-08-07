import { NextRequest, NextResponse } from 'next/server'

/**
 * Apollo Webhook Proxy
 * 
 * This proxy endpoint hides the actual Apollo webhook URL from client code
 * and provides a centralized place for webhook configuration, authentication,
 * and error handling.
 */

const APOLLO_WEBHOOK_URL = process.env.APOLLO_WEBHOOK_URL

export async function POST(request: NextRequest) {
  try {
    // Validate environment configuration
    if (!APOLLO_WEBHOOK_URL) {
      console.error('❌ APOLLO_WEBHOOK_URL environment variable not configured')
      return NextResponse.json(
        { 
          success: false, 
          error: 'Webhook service not configured' 
        },
        { status: 500 }
      )
    }

    // Get request body
    const body = await request.json()
    
    // Log the proxy request (for debugging)
    console.log('🔄 Proxying Apollo webhook request:', {
      timestamp: new Date().toISOString(),
      bodyKeys: Object.keys(body),
      targetUrl: APOLLO_WEBHOOK_URL.replace(/\/[^\/]*$/, '/***') // Hide endpoint details in logs
    })

    // Forward request to actual Apollo webhook
    const response = await fetch(APOLLO_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward relevant headers
        'User-Agent': 'Lokale-Banen-Proxy/1.0',
        // Add authentication headers if needed
        // 'Authorization': `Bearer ${process.env.APOLLO_API_KEY}`,
      },
      body: JSON.stringify(body),
    })

    // Get response data
    const responseData = await response.text()
    let parsedData
    
    try {
      parsedData = JSON.parse(responseData)
    } catch {
      parsedData = { message: responseData }
    }

    // Log the response (for debugging)
    console.log('✅ Apollo webhook response:', {
      status: response.status,
      ok: response.ok,
      timestamp: new Date().toISOString()
    })

    // Return proxied response
    return NextResponse.json(
      {
        success: response.ok,
        data: parsedData,
        status: response.status
      },
      { status: response.status }
    )

  } catch (error) {
    console.error('❌ Apollo webhook proxy error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Webhook proxy failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}

// Add GET method for health checks
export async function GET() {
  return NextResponse.json({
    service: 'Apollo Webhook Proxy',
    status: 'healthy',
    configured: !!APOLLO_WEBHOOK_URL,
    timestamp: new Date().toISOString()
  })
}