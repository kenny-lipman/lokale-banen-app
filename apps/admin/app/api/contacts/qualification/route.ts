import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"

async function qualificationHandler(req: NextRequest, authResult: AuthResult) {
  try {
    const body = await req.json()
    const { contacts, qualification_status } = body

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { error: "contacts array is required" },
        { status: 400 }
      )
    }

    if (!qualification_status) {
      return NextResponse.json(
        { error: "qualification_status is required" },
        { status: 400 }
      )
    }

    console.log(`Updating qualification status to '${qualification_status}' for ${contacts.length} contacts`)

    // Extract IDs from the contact objects to identify them
    const contactIds = contacts
      .map((contact: any) => contact.id)
      .filter(Boolean) // Remove null/empty IDs

    if (contactIds.length === 0) {
      return NextResponse.json(
        { error: "No valid contact IDs found" },
        { status: 400 }
      )
    }

    // Update qualification status in database using IDs
    const { data, error } = await authResult.supabase
      .from('contacts')
      .update({
        qualification_status,
        qualification_timestamp: new Date().toISOString()
      })
      .in('id', contactIds)
      .select()

    if (error) {
      console.error('Error updating qualification status:', error)
      return NextResponse.json(
        { error: 'Failed to update qualification status', details: error.message },
        { status: 500 }
      )
    }

    console.log(`Successfully updated ${data?.length || 0} contacts`)

    return NextResponse.json({
      message: `Successfully updated ${data?.length || 0} contacts`,
      updated_count: data?.length || 0
    })

  } catch (e) {
    console.error("Error in POST /api/contacts/qualification:", e)
    const errorMessage = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({
      error: errorMessage,
      details: String(e)
    }, { status: 500 })
  }
}

export const POST = withAuth(qualificationHandler)