import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateContactUpdate } from '@/lib/validators/contact'
import { ContactUpdateRequest, ContactUpdateResponse } from '@/types/contact'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contactId = params.id
    
    // Parse request body
    const body: ContactUpdateRequest = await request.json()
    
    // Validate input
    const validation = validateContactUpdate(body)
    if (!validation.valid) {
      return NextResponse.json<ContactUpdateResponse>(
        { 
          success: false, 
          error: validation.errors.join(', ') 
        },
        { status: 400 }
      )
    }
    
    // Build update object with only provided fields
    const updateData: any = {}
    const allowedFields = [
      'first_name',
      'last_name',
      'qualification_status',
      'email',
      'title',
      'phone'
    ]
    
    for (const field of allowedFields) {
      if (body[field as keyof ContactUpdateRequest] !== undefined) {
        updateData[field] = body[field as keyof ContactUpdateRequest]
      }
    }
    
    // Add timestamp for qualification status changes
    if (updateData.qualification_status) {
      updateData.qualification_timestamp = new Date().toISOString()
    }
    
    // Update contact in database
    const { data, error } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', contactId)
      .select('*')
      .single()
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json<ContactUpdateResponse>(
        { 
          success: false, 
          error: 'Failed to update contact' 
        },
        { status: 500 }
      )
    }
    
    if (!data) {
      return NextResponse.json<ContactUpdateResponse>(
        { 
          success: false, 
          error: 'Contact not found' 
        },
        { status: 404 }
      )
    }
    
    return NextResponse.json<ContactUpdateResponse>({
      success: true,
      data
    })
    
  } catch (error) {
    console.error('Error updating contact:', error)
    return NextResponse.json<ContactUpdateResponse>(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contactId = params.id
    
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single()
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch contact' },
        { status: 500 }
      )
    }
    
    if (!data) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('Error fetching contact:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}