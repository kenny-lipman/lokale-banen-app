import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-service'

// First, let's create the activity log table migration
const CREATE_ACTIVITY_LOG_TABLE = `
-- Contact Activity Log Table
CREATE TABLE IF NOT EXISTS contact_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('qualification_change', 'campaign_assignment', 'email_verification', 'priority_change', 'key_contact_toggle', 'created', 'updated', 'deleted')),
    old_value JSONB,
    new_value JSONB,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_activity_logs_contact_id ON contact_activity_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_activity_logs_user_id ON contact_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_activity_logs_action_type ON contact_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_contact_activity_logs_created_at ON contact_activity_logs(created_at DESC);

-- Comments
COMMENT ON TABLE contact_activity_logs IS 'Audit trail for all contact-related actions';
COMMENT ON COLUMN contact_activity_logs.action_type IS 'Type of action performed on the contact';
COMMENT ON COLUMN contact_activity_logs.old_value IS 'Previous value before the change';
COMMENT ON COLUMN contact_activity_logs.new_value IS 'New value after the change';
COMMENT ON COLUMN contact_activity_logs.metadata IS 'Additional context about the action';
`

// POST /api/otis/contacts/activity - Log a contact activity
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      contact_id,
      action_type,
      old_value,
      new_value,
      metadata = {},
      session_id
    } = await request.json()
    
    // Validate required fields
    if (!contact_id || !action_type) {
      return NextResponse.json({
        success: false,
        error: 'Contact ID and action type are required'
      }, { status: 400 })
    }
    
    // Validate action type
    const validActions = [
      'qualification_change', 
      'campaign_assignment', 
      'email_verification', 
      'priority_change', 
      'key_contact_toggle', 
      'created', 
      'updated', 
      'deleted'
    ]
    
    if (!validActions.includes(action_type)) {
      return NextResponse.json({
        success: false,
        error: `Invalid action type. Must be one of: ${validActions.join(', ')}`
      }, { status: 400 })
    }
    
    // Get user from auth (if available)
    const { data: { user } } = await supabase.auth.getUser()
    
    // Extract IP and user agent from request headers
    const ip_address = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown'
    const user_agent = request.headers.get('user-agent') || 'unknown'
    
    // Create activity log entry
    const { data: activityLog, error: logError } = await supabase
      .from('contact_activity_logs')
      .insert({
        contact_id,
        user_id: user?.id || null,
        action_type,
        old_value,
        new_value,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          source: 'otis_enhanced_ui'
        },
        ip_address,
        user_agent,
        session_id
      })
      .select()
      .single()
    
    if (logError) {
      console.error('Error creating activity log:', logError)
      
      // If table doesn't exist, try to create it
      if (logError.message.includes('relation "contact_activity_logs" does not exist')) {
        const { error: createError } = await supabase.rpc('exec', { 
          sql: CREATE_ACTIVITY_LOG_TABLE 
        })
        
        if (createError) {
          console.error('Error creating activity log table:', createError)
          return NextResponse.json({
            success: false,
            error: 'Activity logging table not found and could not be created'
          }, { status: 500 })
        }
        
        // Retry the insert after creating table
        const { data: retryLog, error: retryError } = await supabase
          .from('contact_activity_logs')
          .insert({
            contact_id,
            user_id: user?.id || null,
            action_type,
            old_value,
            new_value,
            metadata: {
              ...metadata,
              timestamp: new Date().toISOString(),
              source: 'otis_enhanced_ui'
            },
            ip_address,
            user_agent,
            session_id
          })
          .select()
          .single()
        
        if (retryError) {
          console.error('Retry error creating activity log:', retryError)
          return NextResponse.json({
            success: false,
            error: 'Failed to create activity log'
          }, { status: 500 })
        }
        
        return NextResponse.json({
          success: true,
          data: { activity_log: retryLog },
          message: 'Activity logged successfully (table created)'
        })
      }
      
      return NextResponse.json({
        success: false,
        error: 'Failed to create activity log'
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      data: { activity_log: activityLog },
      message: 'Activity logged successfully'
    })
    
  } catch (error) {
    console.error('Error in contact activity API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// GET /api/otis/contacts/activity?contactId=xxx&limit=50
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    
    const contactId = searchParams.get('contactId')
    const actionType = searchParams.get('actionType')
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    let query = supabase
      .from('contact_activity_logs')
      .select(`
        id,
        contact_id,
        user_id,
        action_type,
        old_value,
        new_value,
        metadata,
        ip_address,
        created_at,
        contacts!inner(
          id,
          name,
          email,
          companies(name)
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    // Apply filters
    if (contactId) {
      query = query.eq('contact_id', contactId)
    }
    
    if (actionType) {
      query = query.eq('action_type', actionType)
    }
    
    if (userId) {
      query = query.eq('user_id', userId)
    }
    
    const { data: activities, error: activitiesError } = await query
    
    if (activitiesError) {
      console.error('Error fetching activity logs:', activitiesError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch activity logs'
      }, { status: 500 })
    }
    
    // Get total count for pagination
    let countQuery = supabase
      .from('contact_activity_logs')
      .select('id', { count: 'exact', head: true })
    
    if (contactId) countQuery = countQuery.eq('contact_id', contactId)
    if (actionType) countQuery = countQuery.eq('action_type', actionType)
    if (userId) countQuery = countQuery.eq('user_id', userId)
    
    const { count } = await countQuery
    
    return NextResponse.json({
      success: true,
      data: {
        activities: activities || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (offset + limit) < (count || 0)
        }
      }
    })
    
  } catch (error) {
    console.error('Error fetching contact activity:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}