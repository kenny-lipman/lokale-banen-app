import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { getMailerLiteClient } from '@/lib/mailerlite-client'

/**
 * GET /api/mailerlite/groups
 * Fetches all MailerLite groups, filtered to "Werkgevers" groups only
 */
async function handler(request: NextRequest, authResult: AuthResult) {
  try {
    const client = getMailerLiteClient();
    const allGroups = await client.listGroups();

    // Filter to only "Werkgevers" groups (case-insensitive)
    const werkgeversGroups = allGroups.filter(group =>
      group.name.toLowerCase().includes('werkgevers')
    );

    return NextResponse.json({
      success: true,
      groups: werkgeversGroups,
      totalCount: werkgeversGroups.length
    });
  } catch (error: any) {
    console.error('Error fetching MailerLite groups:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch MailerLite groups' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handler);
