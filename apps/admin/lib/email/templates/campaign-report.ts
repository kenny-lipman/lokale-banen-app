import { InstantlyCampaignAnalytics } from '@/lib/instantly-client'

interface Totals {
  sent: number
  opens: number
  opensUnique: number
  replies: number
  repliesUnique: number
  clicks: number
  bounces: number
  unsubscribes: number
  leads: number
  contacted: number
  newContacted: number
  completed: number
  opportunities: number
  interested: number
}

interface CampaignReportData {
  date: string
  campaigns: InstantlyCampaignAnalytics[]
  yesterdayMap: Map<string, InstantlyCampaignAnalytics>
  totals: Totals
  yesterdayTotals: Totals
}

const STATUS_LABELS: Record<number, string> = {
  0: 'Draft',
  1: 'Active',
  2: 'Paused',
  3: 'Completed',
}

function statusBadge(status: number): string {
  const colors: Record<number, string> = {
    0: '#6b7280',
    1: '#16a34a',
    2: '#f59e0b',
    3: '#3b82f6',
  }
  const color = colors[status] || '#6b7280'
  const label = STATUS_LABELS[status] || `Status ${status}`
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;">${label}</span>`
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '—'
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

function num(n: number): string {
  return n.toLocaleString('nl-NL')
}

function yesterdayCell(value: number): string {
  if (value === 0) return '<span style="color:#9ca3af;">0</span>'
  return `<span style="color:#1e3a5f;font-weight:600;">${num(value)}</span>`
}

export function buildCampaignReportHtml(data: CampaignReportData): string {
  const { date, campaigns, yesterdayMap, totals, yesterdayTotals } = data

  // Sort: active first, then by yesterday's sent desc, then cumulative sent desc
  const sorted = [...campaigns].sort((a, b) => {
    if (a.campaign_status !== b.campaign_status) {
      if (a.campaign_status === 1) return -1
      if (b.campaign_status === 1) return 1
    }
    const aSent = yesterdayMap.get(a.campaign_id)?.emails_sent_count || 0
    const bSent = yesterdayMap.get(b.campaign_id)?.emails_sent_count || 0
    if (aSent !== bSent) return bSent - aSent
    return b.emails_sent_count - a.emails_sent_count
  })

  // Find top performers (min 10 emails sent cumulative)
  const withActivity = sorted.filter(c => c.emails_sent_count >= 10)
  const topOpenRate = withActivity.length > 0
    ? withActivity.reduce((best, c) => {
        const bestRate = best.open_count_unique / best.emails_sent_count
        const cRate = c.open_count_unique / c.emails_sent_count
        return cRate > bestRate ? c : best
      })
    : null

  const topReplies = withActivity.length > 0
    ? withActivity.reduce((best, c) => c.reply_count > best.reply_count ? c : best)
    : null

  const highBounce = withActivity.filter(c => (c.bounced_count / c.emails_sent_count) > 0.05)

  const campaignRows = sorted.map(c => {
    const y = yesterdayMap.get(c.campaign_id)
    const ySent = y?.emails_sent_count || 0
    const yOpens = y?.open_count_unique || 0
    const yReplies = y?.reply_count_unique || 0
    const yBounces = y?.bounced_count || 0
    const yContacted = y?.contacted_count || 0
    const yNewContacted = y?.new_leads_contacted_count || 0
    const yCompleted = y?.completed_count || 0
    const yOpportunities = y?.total_opportunities || 0
    const yInterested = y?.total_interested || 0

    return `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:8px 6px;font-weight:500;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">${c.campaign_name}</td>
      <td style="padding:8px 4px;text-align:center;">${statusBadge(c.campaign_status)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;">${num(c.leads_count)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;background:#f0f9ff;">${yesterdayCell(ySent)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;color:#6b7280;">${num(c.emails_sent_count)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;background:#f0f9ff;">${yesterdayCell(yContacted)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;color:#6b7280;">${num(c.contacted_count)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;background:#f0f9ff;">${yesterdayCell(yNewContacted)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;color:#6b7280;">${num(c.new_leads_contacted_count)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;background:#f0f9ff;">${yesterdayCell(yOpens)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;color:#6b7280;">${num(c.open_count_unique)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;color:${c.emails_sent_count > 0 && (c.open_count_unique / c.emails_sent_count) > 0.3 ? '#16a34a' : '#374151'};">${pct(c.open_count_unique, c.emails_sent_count)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;background:#f0f9ff;">${yesterdayCell(yReplies)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;color:#6b7280;">${num(c.reply_count_unique)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;color:${c.emails_sent_count > 0 && (c.reply_count_unique / c.emails_sent_count) > 0.03 ? '#16a34a' : '#374151'};">${pct(c.reply_count_unique, c.emails_sent_count)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;color:${yBounces > 0 ? '#dc2626' : '#6b7280'};background:${yBounces > 0 ? '#fef2f2' : '#f0f9ff'};">${yesterdayCell(yBounces)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;color:${c.emails_sent_count > 0 && (c.bounced_count / c.emails_sent_count) > 0.05 ? '#dc2626' : '#6b7280'};">${num(c.bounced_count)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;background:#f0f9ff;">${yesterdayCell(yCompleted)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;color:#6b7280;">${num(c.completed_count)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;background:#f0f9ff;">${yesterdayCell(yOpportunities)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;color:#6b7280;">${num(c.total_opportunities)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;background:#f0f9ff;">${yesterdayCell(yInterested)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;color:#6b7280;">${num(c.total_interested || 0)}</td>
    </tr>`
  }).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;">
  <div style="max-width:1200px;margin:0 auto;padding:20px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:22px;font-weight:700;">Instantly Campaign Rapport</h1>
      <p style="margin:8px 0 0;opacity:0.85;font-size:14px;">${date}</p>
    </div>

    <!-- Summary Cards: Yesterday -->
    <div style="background:#eef6ff;padding:20px 32px;border-bottom:1px solid #bfdbfe;">
      <h3 style="margin:0 0 12px;font-size:13px;color:#1e3a5f;text-transform:uppercase;letter-spacing:1px;">Gisteren</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #bfdbfe;">
            <div style="font-size:28px;font-weight:700;color:#1e3a5f;">${num(yesterdayTotals.sent)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Verzonden</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #bfdbfe;">
            <div style="font-size:28px;font-weight:700;color:#1e3a5f;">${num(yesterdayTotals.contacted)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Contacted</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #bfdbfe;">
            <div style="font-size:28px;font-weight:700;color:#1e3a5f;">${num(yesterdayTotals.newContacted)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">New Contacted</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #bfdbfe;">
            <div style="font-size:28px;font-weight:700;color:#2563eb;">${num(yesterdayTotals.opensUnique)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Opens</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #bfdbfe;">
            <div style="font-size:28px;font-weight:700;color:#16a34a;">${num(yesterdayTotals.repliesUnique)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Replies</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #bfdbfe;">
            <div style="font-size:28px;font-weight:700;color:#7c3aed;">${num(yesterdayTotals.clicks)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Clicks</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #bfdbfe;">
            <div style="font-size:28px;font-weight:700;color:${yesterdayTotals.bounces > 0 ? '#dc2626' : '#6b7280'};">${num(yesterdayTotals.bounces)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Bounces</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #bfdbfe;">
            <div style="font-size:28px;font-weight:700;color:#0891b2;">${num(yesterdayTotals.completed)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Completed</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #bfdbfe;">
            <div style="font-size:28px;font-weight:700;color:#ea580c;">${num(yesterdayTotals.opportunities)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Opportunities</div>
          </td>
          <td style="padding:8px 12px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#16a34a;">${num(yesterdayTotals.interested)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Interested</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Summary Cards: Cumulative -->
    <div style="background:#fff;padding:20px 32px;border-bottom:1px solid #e5e7eb;">
      <h3 style="margin:0 0 12px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Cumulatief</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #e5e7eb;">
            <div style="font-size:22px;font-weight:700;color:#374151;">${num(totals.sent)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Verzonden (${pct(totals.opensUnique, totals.sent)} open rate)</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #e5e7eb;">
            <div style="font-size:22px;font-weight:700;color:#374151;">${num(totals.contacted)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Contacted</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #e5e7eb;">
            <div style="font-size:22px;font-weight:700;color:#374151;">${num(totals.newContacted)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">New Contacted</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #e5e7eb;">
            <div style="font-size:22px;font-weight:700;color:#374151;">${num(totals.opensUnique)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Opens</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #e5e7eb;">
            <div style="font-size:22px;font-weight:700;color:#374151;">${num(totals.repliesUnique)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Replies (${pct(totals.repliesUnique, totals.sent)})</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #e5e7eb;">
            <div style="font-size:22px;font-weight:700;color:#374151;">${num(totals.clicks)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Clicks</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #e5e7eb;">
            <div style="font-size:22px;font-weight:700;color:#374151;">${num(totals.bounces)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Bounces (${pct(totals.bounces, totals.sent)})</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #e5e7eb;">
            <div style="font-size:22px;font-weight:700;color:#374151;">${num(totals.completed)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Completed</div>
          </td>
          <td style="padding:8px 12px;text-align:center;border-right:1px solid #e5e7eb;">
            <div style="font-size:22px;font-weight:700;color:#374151;">${num(totals.opportunities)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Opportunities</div>
          </td>
          <td style="padding:8px 12px;text-align:center;">
            <div style="font-size:22px;font-weight:700;color:#374151;">${num(totals.interested)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Interested</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Highlights -->
    <div style="background:#fff;padding:16px 32px;border-bottom:1px solid #e5e7eb;">
      ${topOpenRate ? `<p style="margin:4px 0;font-size:13px;">🏆 <strong>Beste open rate:</strong> ${topOpenRate.campaign_name} — ${pct(topOpenRate.open_count_unique, topOpenRate.emails_sent_count)}</p>` : ''}
      ${topReplies && topReplies.reply_count > 0 ? `<p style="margin:4px 0;font-size:13px;">💬 <strong>Meeste replies:</strong> ${topReplies.campaign_name} — ${topReplies.reply_count} replies</p>` : ''}
      ${highBounce.length > 0 ? `<p style="margin:4px 0;font-size:13px;color:#dc2626;">⚠️ <strong>Hoge bounce rate:</strong> ${highBounce.map(c => `${c.campaign_name} (${pct(c.bounced_count, c.emails_sent_count)})`).join(', ')}</p>` : ''}
    </div>

    <!-- Campaign Table -->
    <div style="background:#fff;padding:16px 24px 24px;border-radius:0 0 12px 12px;overflow-x:auto;">
      <h2 style="font-size:16px;margin:8px 0 16px;color:#1e3a5f;">Per Campagne</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="border-bottom:2px solid #e5e7eb;">
            <th style="padding:8px 6px;text-align:left;font-weight:600;color:#374151;" rowspan="2">Campagne</th>
            <th style="padding:8px 4px;text-align:center;font-weight:600;color:#374151;" rowspan="2">Status</th>
            <th style="padding:8px 4px;text-align:right;font-weight:600;color:#374151;" rowspan="2">Leads</th>
            <th style="padding:4px 4px;text-align:center;font-weight:600;color:#1e3a5f;background:#eef6ff;border-bottom:1px solid #bfdbfe;" colspan="2">Sent</th>
            <th style="padding:4px 4px;text-align:center;font-weight:600;color:#1e3a5f;background:#eef6ff;border-bottom:1px solid #bfdbfe;" colspan="2">Contacted</th>
            <th style="padding:4px 4px;text-align:center;font-weight:600;color:#1e3a5f;background:#eef6ff;border-bottom:1px solid #bfdbfe;" colspan="2">New Contacted</th>
            <th style="padding:4px 4px;text-align:center;font-weight:600;color:#1e3a5f;background:#eef6ff;border-bottom:1px solid #bfdbfe;" colspan="3">Opens</th>
            <th style="padding:4px 4px;text-align:center;font-weight:600;color:#1e3a5f;background:#eef6ff;border-bottom:1px solid #bfdbfe;" colspan="3">Replies (uniek)</th>
            <th style="padding:4px 4px;text-align:center;font-weight:600;color:#1e3a5f;background:#eef6ff;border-bottom:1px solid #bfdbfe;" colspan="2">Bounces</th>
            <th style="padding:4px 4px;text-align:center;font-weight:600;color:#1e3a5f;background:#eef6ff;border-bottom:1px solid #bfdbfe;" colspan="2">Completed</th>
            <th style="padding:4px 4px;text-align:center;font-weight:600;color:#1e3a5f;background:#eef6ff;border-bottom:1px solid #bfdbfe;" colspan="2">Opportunities</th>
            <th style="padding:4px 4px;text-align:center;font-weight:600;color:#1e3a5f;background:#eef6ff;border-bottom:1px solid #bfdbfe;" colspan="2">Interested</th>
          </tr>
          <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#1e3a5f;background:#eef6ff;font-size:10px;">Gisteren</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#6b7280;font-size:10px;">Totaal</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#1e3a5f;background:#eef6ff;font-size:10px;">Gisteren</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#6b7280;font-size:10px;">Totaal</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#1e3a5f;background:#eef6ff;font-size:10px;">Gisteren</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#6b7280;font-size:10px;">Totaal</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#1e3a5f;background:#eef6ff;font-size:10px;">Gisteren</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#6b7280;font-size:10px;">Totaal</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#6b7280;font-size:10px;">Rate</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#1e3a5f;background:#eef6ff;font-size:10px;">Gisteren</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#6b7280;font-size:10px;">Totaal</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#6b7280;font-size:10px;">Rate</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#1e3a5f;background:#eef6ff;font-size:10px;">Gisteren</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#6b7280;font-size:10px;">Totaal</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#1e3a5f;background:#eef6ff;font-size:10px;">Gisteren</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#6b7280;font-size:10px;">Totaal</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#1e3a5f;background:#eef6ff;font-size:10px;">Gisteren</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#6b7280;font-size:10px;">Totaal</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#1e3a5f;background:#eef6ff;font-size:10px;">Gisteren</th>
            <th style="padding:4px 4px;text-align:right;font-weight:600;color:#6b7280;font-size:10px;">Totaal</th>
          </tr>
        </thead>
        <tbody>
          ${campaignRows}
        </tbody>
        <tfoot>
          <tr style="background:#f0f9ff;border-top:2px solid #2563eb;font-weight:700;font-size:12px;">
            <td style="padding:8px 6px;" colspan="2">Totaal (${sorted.length} campagnes)</td>
            <td style="padding:8px 4px;text-align:right;">${num(totals.leads)}</td>
            <td style="padding:8px 4px;text-align:right;background:#dbeafe;">${num(yesterdayTotals.sent)}</td>
            <td style="padding:8px 4px;text-align:right;">${num(totals.sent)}</td>
            <td style="padding:8px 4px;text-align:right;background:#dbeafe;">${num(yesterdayTotals.contacted)}</td>
            <td style="padding:8px 4px;text-align:right;">${num(totals.contacted)}</td>
            <td style="padding:8px 4px;text-align:right;background:#dbeafe;">${num(yesterdayTotals.newContacted)}</td>
            <td style="padding:8px 4px;text-align:right;">${num(totals.newContacted)}</td>
            <td style="padding:8px 4px;text-align:right;background:#dbeafe;">${num(yesterdayTotals.opensUnique)}</td>
            <td style="padding:8px 4px;text-align:right;">${num(totals.opensUnique)}</td>
            <td style="padding:8px 4px;text-align:right;">${pct(totals.opensUnique, totals.sent)}</td>
            <td style="padding:8px 4px;text-align:right;background:#dbeafe;">${num(yesterdayTotals.repliesUnique)}</td>
            <td style="padding:8px 4px;text-align:right;">${num(totals.repliesUnique)}</td>
            <td style="padding:8px 4px;text-align:right;">${pct(totals.repliesUnique, totals.sent)}</td>
            <td style="padding:8px 4px;text-align:right;background:#dbeafe;">${num(yesterdayTotals.bounces)}</td>
            <td style="padding:8px 4px;text-align:right;">${num(totals.bounces)}</td>
            <td style="padding:8px 4px;text-align:right;background:#dbeafe;">${num(yesterdayTotals.completed)}</td>
            <td style="padding:8px 4px;text-align:right;">${num(totals.completed)}</td>
            <td style="padding:8px 4px;text-align:right;background:#dbeafe;">${num(yesterdayTotals.opportunities)}</td>
            <td style="padding:8px 4px;text-align:right;">${num(totals.opportunities)}</td>
            <td style="padding:8px 4px;text-align:right;background:#dbeafe;">${num(yesterdayTotals.interested)}</td>
            <td style="padding:8px 4px;text-align:right;">${num(totals.interested)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Footer -->
    <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:16px;">
      Automatisch gegenereerd door Lokale Banen — ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC
    </p>
  </div>
</body>
</html>`
}

export function buildCampaignReportSubject(data: CampaignReportData): string {
  const activeCampaigns = data.campaigns.filter(c => c.campaign_status === 1).length
  return `Instantly Dagrapport — ${data.date} — ${num(data.yesterdayTotals.sent)} verzonden gisteren, ${activeCampaigns} actieve campagnes`
}
