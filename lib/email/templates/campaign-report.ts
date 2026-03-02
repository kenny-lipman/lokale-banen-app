import { InstantlyCampaignAnalytics } from '@/lib/instantly-client'

interface CampaignReportData {
  date: string
  campaigns: InstantlyCampaignAnalytics[]
  totals: {
    sent: number
    opens: number
    opensUnique: number
    replies: number
    repliesUnique: number
    clicks: number
    bounces: number
    unsubscribes: number
    leads: number
  }
}

const STATUS_LABELS: Record<number, string> = {
  0: 'Draft',
  1: 'Active',
  2: 'Paused',
  3: 'Completed',
}

function statusBadge(status: number): string {
  const colors: Record<number, string> = {
    0: '#6b7280', // gray
    1: '#16a34a', // green
    2: '#f59e0b', // amber
    3: '#3b82f6', // blue
  }
  const color = colors[status] || '#6b7280'
  const label = STATUS_LABELS[status] || `Status ${status}`
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;">${label}</span>`
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '0.0%'
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

export function buildCampaignReportHtml(data: CampaignReportData): string {
  const { date, campaigns, totals } = data

  // Sort: active first, then by emails sent descending
  const sorted = [...campaigns].sort((a, b) => {
    if (a.campaign_status !== b.campaign_status) {
      if (a.campaign_status === 1) return -1
      if (b.campaign_status === 1) return 1
    }
    return b.emails_sent_count - a.emails_sent_count
  })

  // Find top performer (by open rate, min 10 emails sent)
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

  // High bounce warnings (>5%)
  const highBounce = withActivity.filter(c => (c.bounced_count / c.emails_sent_count) > 0.05)

  const campaignRows = sorted.map(c => `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:10px 8px;font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.campaign_name}</td>
      <td style="padding:10px 8px;text-align:center;">${statusBadge(c.campaign_status)}</td>
      <td style="padding:10px 8px;text-align:right;">${c.leads_count.toLocaleString('nl-NL')}</td>
      <td style="padding:10px 8px;text-align:right;font-weight:600;">${c.emails_sent_count.toLocaleString('nl-NL')}</td>
      <td style="padding:10px 8px;text-align:right;">${c.open_count_unique.toLocaleString('nl-NL')}</td>
      <td style="padding:10px 8px;text-align:right;color:${c.emails_sent_count > 0 && (c.open_count_unique / c.emails_sent_count) > 0.3 ? '#16a34a' : '#374151'};">${pct(c.open_count_unique, c.emails_sent_count)}</td>
      <td style="padding:10px 8px;text-align:right;">${c.reply_count.toLocaleString('nl-NL')}</td>
      <td style="padding:10px 8px;text-align:right;color:${c.emails_sent_count > 0 && (c.reply_count / c.emails_sent_count) > 0.03 ? '#16a34a' : '#374151'};">${pct(c.reply_count, c.emails_sent_count)}</td>
      <td style="padding:10px 8px;text-align:right;">${c.link_click_count.toLocaleString('nl-NL')}</td>
      <td style="padding:10px 8px;text-align:right;color:${c.emails_sent_count > 0 && (c.bounced_count / c.emails_sent_count) > 0.05 ? '#dc2626' : '#374151'};">${c.bounced_count.toLocaleString('nl-NL')}</td>
      <td style="padding:10px 8px;text-align:right;">${c.unsubscribed_count.toLocaleString('nl-NL')}</td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;">
  <div style="max-width:900px;margin:0 auto;padding:20px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;">
      <h1 style="margin:0;font-size:22px;font-weight:700;">Instantly Campaign Rapport</h1>
      <p style="margin:8px 0 0;opacity:0.85;font-size:14px;">${date}</p>
    </div>

    <!-- Summary Cards -->
    <div style="background:#fff;padding:24px 32px;border-bottom:1px solid #e5e7eb;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:8px 16px;text-align:center;border-right:1px solid #e5e7eb;">
            <div style="font-size:28px;font-weight:700;color:#1e3a5f;">${totals.sent.toLocaleString('nl-NL')}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Verzonden</div>
          </td>
          <td style="padding:8px 16px;text-align:center;border-right:1px solid #e5e7eb;">
            <div style="font-size:28px;font-weight:700;color:#2563eb;">${totals.opensUnique.toLocaleString('nl-NL')}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Opens (${pct(totals.opensUnique, totals.sent)})</div>
          </td>
          <td style="padding:8px 16px;text-align:center;border-right:1px solid #e5e7eb;">
            <div style="font-size:28px;font-weight:700;color:#16a34a;">${totals.replies.toLocaleString('nl-NL')}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Replies (${pct(totals.replies, totals.sent)})</div>
          </td>
          <td style="padding:8px 16px;text-align:center;border-right:1px solid #e5e7eb;">
            <div style="font-size:28px;font-weight:700;color:#7c3aed;">${totals.clicks.toLocaleString('nl-NL')}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Clicks</div>
          </td>
          <td style="padding:8px 16px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:${totals.sent > 0 && (totals.bounces / totals.sent) > 0.05 ? '#dc2626' : '#f59e0b'};">${totals.bounces.toLocaleString('nl-NL')}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Bounces (${pct(totals.bounces, totals.sent)})</div>
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
    <div style="background:#fff;padding:16px 32px 24px;border-radius:0 0 12px 12px;overflow-x:auto;">
      <h2 style="font-size:16px;margin:8px 0 16px;color:#1e3a5f;">Per Campagne</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
            <th style="padding:10px 8px;text-align:left;font-weight:600;color:#374151;">Campagne</th>
            <th style="padding:10px 8px;text-align:center;font-weight:600;color:#374151;">Status</th>
            <th style="padding:10px 8px;text-align:right;font-weight:600;color:#374151;">Leads</th>
            <th style="padding:10px 8px;text-align:right;font-weight:600;color:#374151;">Sent</th>
            <th style="padding:10px 8px;text-align:right;font-weight:600;color:#374151;">Opens</th>
            <th style="padding:10px 8px;text-align:right;font-weight:600;color:#374151;">Open%</th>
            <th style="padding:10px 8px;text-align:right;font-weight:600;color:#374151;">Replies</th>
            <th style="padding:10px 8px;text-align:right;font-weight:600;color:#374151;">Reply%</th>
            <th style="padding:10px 8px;text-align:right;font-weight:600;color:#374151;">Clicks</th>
            <th style="padding:10px 8px;text-align:right;font-weight:600;color:#374151;">Bounces</th>
            <th style="padding:10px 8px;text-align:right;font-weight:600;color:#374151;">Unsub</th>
          </tr>
        </thead>
        <tbody>
          ${campaignRows}
        </tbody>
        <tfoot>
          <tr style="background:#f0f9ff;border-top:2px solid #2563eb;font-weight:700;">
            <td style="padding:10px 8px;" colspan="2">Totaal (${sorted.length} campagnes)</td>
            <td style="padding:10px 8px;text-align:right;">${totals.leads.toLocaleString('nl-NL')}</td>
            <td style="padding:10px 8px;text-align:right;">${totals.sent.toLocaleString('nl-NL')}</td>
            <td style="padding:10px 8px;text-align:right;">${totals.opensUnique.toLocaleString('nl-NL')}</td>
            <td style="padding:10px 8px;text-align:right;">${pct(totals.opensUnique, totals.sent)}</td>
            <td style="padding:10px 8px;text-align:right;">${totals.replies.toLocaleString('nl-NL')}</td>
            <td style="padding:10px 8px;text-align:right;">${pct(totals.replies, totals.sent)}</td>
            <td style="padding:10px 8px;text-align:right;">${totals.clicks.toLocaleString('nl-NL')}</td>
            <td style="padding:10px 8px;text-align:right;">${totals.bounces.toLocaleString('nl-NL')}</td>
            <td style="padding:10px 8px;text-align:right;">${totals.unsubscribes.toLocaleString('nl-NL')}</td>
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
  return `Instantly Dagrapport — ${data.date} — ${data.totals.sent.toLocaleString('nl-NL')} emails, ${activeCampaigns} actieve campagnes`
}
