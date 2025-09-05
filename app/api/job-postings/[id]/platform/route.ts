import { NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    
    // Create an authenticated client using the user's token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    })

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error("Auth error:", authError)
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }

    const { platform_id } = await request.json()

    // Update the job posting's platform_id
    const { data, error } = await supabase
      .from("job_postings")
      .update({ platform_id })
      .eq("id", params.id)
      .select(`
        id,
        platform_id,
        platforms:platform_id(id, regio_platform)
      `)
      .single()

    if (error) {
      console.error("Error updating job posting platform:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        id: data.id,
        platform_id: data.platform_id,
        regio_platform: data.platforms?.regio_platform || null
      }
    })
  } catch (error: any) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}