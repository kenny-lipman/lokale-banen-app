/**
 * Simple test for Pipedrive Notes API (no auth required)
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    console.log(`🔍 Simple Pipedrive Notes API test`)

    const apiToken = process.env.PIPEDRIVE_API_KEY;

    if (!apiToken) {
      return NextResponse.json({
        success: false,
        error: 'PIPEDRIVE_API_KEY not found in environment variables'
      })
    }

    const payload = {
      "content": "Test note from simple API test - DELETE ME",
      "org_id": 38081
    };

    const notesUrl = `https://api.pipedrive.com/v1/notes?api_token=${apiToken}`;

    console.log(`🧪 Testing POST request to Pipedrive Notes API`);
    console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));
    console.log(`🔗 URL: ${notesUrl.replace(apiToken, '[HIDDEN]')}`);

    const response = await fetch(notesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log(`📡 Response status: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    console.log(`📄 Response body (first 1000 chars):`, responseText.substring(0, 1000));

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (parseError) {
      parsedResponse = {
        raw_response: responseText,
        parse_error: parseError.message
      };
    }

    return NextResponse.json({
      test_result: {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        response: parsedResponse
      },
      debug_info: {
        api_token_present: !!apiToken,
        api_token_length: apiToken ? apiToken.length : 0,
        test_payload: payload,
        url_used: notesUrl.replace(apiToken, '[HIDDEN]')
      }
    })

  } catch (error) {
    console.error('Simple Pipedrive notes test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}