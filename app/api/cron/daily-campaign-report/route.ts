/**
 * Cron Job: Daily Campaign Report
 *
 * Fetches all campaign analytics from Instantly (cumulative + yesterday) and sends
 * a summary email to kenny@bespokeautomation.ai via Resend.
 *
 * Schedule: Daily at 08:00 UTC (09:00 NL winter / 10:00 NL summer)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCronMonitoring } from '@/lib/cron-monitor'
import { resend } from '@/lib/email/resend-client'
import { instantlyClient } from '@/lib/instantly-client'
import { buildCampaignReportHtml, buildCampaignReportSubject } from '@/lib/email/templates/campaign-report'

const REPORT_RECIPIENT = 'kenny@bespokeautomation.ai'

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10) // YYYY-MM-DD
}

async function handler(_request: NextRequest) {
  const startTime = Date.now()

  console.log(`📊 Starting daily campaign report at ${new Date().toISOString()}`)

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = toDateString(yesterday)

  // 1. Fetch cumulative + yesterday's analytics in parallel
  const [analytics, yesterdayAnalytics] = await Promise.all([
    instantlyClient.getAllCampaignsAnalytics(),
    instantlyClient.getAllCampaignsAnalyticsByDate(yesterdayStr, yesterdayStr),
  ])

  if (!analytics || analytics.length === 0) {
    console.log('⚠️ No campaign analytics found')
    return NextResponse.json({
      success: true,
      message: 'No campaigns found — skipped email',
      duration: Date.now() - startTime,
    })
  }

  console.log(`📈 Fetched analytics for ${analytics.length} campaigns (${yesterdayAnalytics.length} with activity yesterday)`)

  // 2. Build yesterday lookup by campaign_id
  const yesterdayMap = new Map(yesterdayAnalytics.map(c => [c.campaign_id, c]))

  // 3. Calculate totals
  const calcTotals = (data: typeof analytics) =>
    data.reduce(
      (acc, c) => ({
        sent: acc.sent + c.emails_sent_count,
        opens: acc.opens + c.open_count,
        opensUnique: acc.opensUnique + c.open_count_unique,
        replies: acc.replies + c.reply_count,
        repliesUnique: acc.repliesUnique + c.reply_count_unique,
        clicks: acc.clicks + c.link_click_count,
        bounces: acc.bounces + c.bounced_count,
        unsubscribes: acc.unsubscribes + c.unsubscribed_count,
        leads: acc.leads + c.leads_count,
        contacted: acc.contacted + c.contacted_count,
        newContacted: acc.newContacted + c.new_leads_contacted_count,
        completed: acc.completed + c.completed_count,
        opportunities: acc.opportunities + c.total_opportunities,
        interested: acc.interested + (c.total_interested || 0),
      }),
      { sent: 0, opens: 0, opensUnique: 0, replies: 0, repliesUnique: 0, clicks: 0, bounces: 0, unsubscribes: 0, leads: 0, contacted: 0, newContacted: 0, completed: 0, opportunities: 0, interested: 0 }
    )

  const totals = calcTotals(analytics)
  const yesterdayTotals = calcTotals(yesterdayAnalytics)

  // 4. Format date for report (show yesterday's date)
  const dateStr = yesterday.toLocaleDateString('nl-NL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const reportData = { date: dateStr, campaigns: analytics, yesterdayMap, totals, yesterdayTotals }

  // 5. Build and send email
  const html = buildCampaignReportHtml(reportData)
  const subject = buildCampaignReportSubject(reportData)

  const { error } = await resend.emails.send({
    from: 'Lokale Banen <onboarding@resend.dev>',
    to: [REPORT_RECIPIENT],
    subject,
    html,
  })

  if (error) {
    console.error('❌ Failed to send email:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send email', details: error.message },
      { status: 500 }
    )
  }

  const duration = Date.now() - startTime
  const activeCampaigns = analytics.filter(c => c.campaign_status === 1).length

  console.log(`✅ Campaign report sent to ${REPORT_RECIPIENT} in ${duration}ms`)

  return NextResponse.json({
    success: true,
    message: `Report sent to ${REPORT_RECIPIENT}`,
    stats: {
      campaigns: analytics.length,
      activeCampaigns,
      totalSent: totals.sent,
      yesterdaySent: yesterdayTotals.sent,
      totalOpens: totals.opensUnique,
      yesterdayOpens: yesterdayTotals.opensUnique,
      totalReplies: totals.repliesUnique,
      yesterdayReplies: yesterdayTotals.repliesUnique,
      totalBounces: totals.bounces,
    },
    duration,
  })
}

const monitored = withCronMonitoring('daily-campaign-report', '/api/cron/daily-campaign-report')
export const GET = monitored(handler)
