import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"

async function statusHandler(req: NextRequest, authResult: AuthResult) {
  try {
    const body = await req.json()
    const { contactIds, status } = body
    
    if (!Array.isArray(contactIds) || !status) {
      return NextResponse.json({ 
        error: "contactIds array and status are required" 
      }, { status: 400 })
    }
    
    console.log(`API: Updating status for ${contactIds.length} contacts to "${status}"`)
    
    // Update the company_status field for all selected contacts
    const { data, error } = await authResult.supabase
      .from("contacts")
      .update({ company_status: status })
      .in("id", contactIds)
      .select("id, company_status")
    
    if (error) {
      console.error("API: Error updating contact statuses:", error)
      return NextResponse.json({ 
        error: "Failed to update contact statuses",
        details: error.message 
      }, { status: 500 })
    }
    
    console.log(`API: Successfully updated status for ${data?.length || 0} contacts`)
    
    return NextResponse.json({ 
      success: true,
      updatedCount: data?.length || 0,
      message: `Status updated for ${data?.length || 0} contacts to "${status}"`
    })
    
  } catch (e) {
    console.error("API: Error in PUT /api/contacts/status:", e)
    const errorMessage = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ 
      error: errorMessage, 
      details: String(e)
    }, { status: 500 })
  }
}

export const PUT = withAuth(statusHandler) 