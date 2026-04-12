import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

/**
 * RSL 1.0 (Robots Source Licensing) manifest.
 * Permits AI search engines to cite content with attribution.
 * Blocks content from being used for model training.
 */
export async function GET() {
  const headersList = await headers()
  const host = headersList.get('x-tenant-host') || 'lokalebanen.nl'
  const baseUrl = `https://${host}`

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsl version="1.0" xmlns="https://rsl.org/schema/1.0">
  <site>
    <url>${baseUrl}</url>
    <name>${host.replace(/\.\w+$/, '').replace(/-/g, ' ')}</name>
    <owner>Lokale Banen B.V.</owner>
    <contact>info@lokalebanen.nl</contact>
  </site>

  <permissions>
    <!-- AI search engines may cite and link to our content -->
    <permission>
      <agent>ai-search</agent>
      <action>cite</action>
      <scope>all</scope>
      <attribution required="true">
        <format>Source: {site_name} ({url})</format>
      </attribution>
    </permission>

    <permission>
      <agent>ai-search</agent>
      <action>summarize</action>
      <scope>all</scope>
      <attribution required="true">
        <format>Via {site_name}</format>
      </attribution>
    </permission>

    <!-- Explicitly deny training use -->
    <permission>
      <agent>ai-training</agent>
      <action>train</action>
      <scope>all</scope>
      <allowed>false</allowed>
    </permission>

    <permission>
      <agent>ai-training</agent>
      <action>fine-tune</action>
      <scope>all</scope>
      <allowed>false</allowed>
    </permission>
  </permissions>

  <content>
    <feed type="sitemap">${baseUrl}/sitemap.xml</feed>
    <feed type="llms-txt">${baseUrl}/llms.txt</feed>
  </content>
</rsl>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  })
}
