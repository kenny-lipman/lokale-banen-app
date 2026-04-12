/**
 * Debug API for testing Pipedrive Notes API directly
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'

async function pipedriveNotesTestHandler(req: NextRequest, authResult: AuthResult) {
  try {
    console.log(`🔍 Testing Pipedrive Notes API for user: ${authResult.user.email}`)

    const apiToken = process.env.PIPEDRIVE_API_TOKEN;

    if (!apiToken) {
      return NextResponse.json({
        success: false,
        error: 'PIPEDRIVE_API_TOKEN not found in environment variables'
      })
    }

    const payload = {
      "content": "Test note from blocklist sync - DELETE ME",
      "org_id": 38081
    };

    const notesUrl = `https://api.pipedrive.com/v1/notes?api_token=${apiToken}`;

    console.log(`🧪 Testing POST ${notesUrl.replace(apiToken, '[HIDDEN]')}`);
    console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));

    const response = await fetch(notesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log(`📡 Response status: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    console.log(`📄 Response body:`, responseText);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      result = {
        raw_response: responseText,
        parse_error: parseError.message
      };
    }

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      response: result,
      test_payload: payload,
      api_token_present: !!apiToken,
      api_token_length: apiToken ? apiToken.length : 0
    })

  } catch (error) {
    console.error('Pipedrive notes test failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

export const POST = withAuth(pipedriveNotesTestHandler)