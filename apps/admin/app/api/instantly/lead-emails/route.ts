/**
 * Instantly Lead Emails API
 *
 * Fetches email conversation history for a specific lead from Instantly.
 * Used to show reply content in the sync event drawer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { instantlyClient, InstantlyEmail } from '@/lib/instantly-client';

export interface LeadEmailResponse {
  success: boolean;
  data?: {
    leadEmail: string;
    campaignId?: string;
    totalEmails: number;
    sentCount: number;
    receivedCount: number;
    emails: Array<{
      id: string;
      type: 'sent' | 'received';
      date: string;
      subject: string;
      body: string;
      preview: string;
      isAutoReply: boolean;
      step?: number;
    }>;
  };
  error?: string;
}

/**
 * GET /api/instantly/lead-emails
 *
 * Query parameters:
 * - email (required): The lead's email address
 * - campaign_id (optional): Filter by campaign
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const campaignId = searchParams.get('campaign_id') || undefined;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    console.log(`📧 Fetching email history for ${email}${campaignId ? ` in campaign ${campaignId}` : ''}`);

    // Fetch all emails for this lead
    const emails = await instantlyClient.getLeadEmailHistory(email, campaignId);

    // Process and categorize emails
    let sentCount = 0;
    let receivedCount = 0;

    const processedEmails = emails.map((emailItem: InstantlyEmail) => {
      // Determine if sent or received
      // Emails TO the lead are "sent", emails FROM the lead are "received"
      const toAddresses = emailItem.to_address_email_list?.toLowerCase() || '';
      const isSentToLead = toAddresses.includes(email.toLowerCase());
      const isReceived = emailItem.email_type === 'received' || !isSentToLead;

      if (isReceived) {
        receivedCount++;
      } else {
        sentCount++;
      }

      // Get body text (prefer text over html for readability)
      const bodyText = emailItem.body?.text || '';
      const bodyHtml = emailItem.body?.html || '';
      const body = bodyText || stripHtml(bodyHtml);

      // Create preview (first 200 chars)
      const preview = body.substring(0, 200).replace(/\n+/g, ' ').trim() + (body.length > 200 ? '...' : '');

      return {
        id: emailItem.id,
        type: (isReceived ? 'received' : 'sent') as 'sent' | 'received',
        date: emailItem.timestamp_email || emailItem.timestamp_created,
        subject: emailItem.subject || '(geen onderwerp)',
        body,
        preview,
        isAutoReply: emailItem.is_auto_reply === 1,
        step: emailItem.step,
      };
    });

    const response: LeadEmailResponse = {
      success: true,
      data: {
        leadEmail: email,
        campaignId,
        totalEmails: emails.length,
        sentCount,
        receivedCount,
        emails: processedEmails,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching lead emails:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch emails',
      },
      { status: 500 }
    );
  }
}

/**
 * Simple HTML tag stripper for fallback body content
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp;
    .replace(/&amp;/g, '&')  // Replace &amp;
    .replace(/&lt;/g, '<')   // Replace &lt;
    .replace(/&gt;/g, '>')   // Replace &gt;
    .replace(/&quot;/g, '"') // Replace &quot;
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}
