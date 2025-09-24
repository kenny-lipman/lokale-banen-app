import { NextRequest, NextResponse } from "next/server"
import { getInstantlyConfig } from "@/lib/api-config"

export async function GET(req: NextRequest) {
  try {
    // Get secure API configuration
    const instantlyConfig = getInstantlyConfig()

    // Fetch all campaigns with pagination
    let allCampaigns: any[] = []
    let skip = 0
    const limit = 100 // Maximum allowed by Instantly API
    let hasMore = true

    while (hasMore) {
      // Gebruik de v2 API met Bearer token authentication en pagination
      const url = `${instantlyConfig.baseUrl}/api/v2/campaigns?skip=${skip}&limit=${limit}`
      console.log("Fetching from:", url)

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${instantlyConfig.apiKey}`,
          "Content-Type": "application/json"
        }
      })
      
      if (!res.ok) {
        const text = await res.text();
        console.error("Instantly API error:", res.status, text)
        return NextResponse.json({ error: "Fout bij ophalen Instantly campagnes", details: text }, { status: 500 })
      }
      
      const data = await res.json()
      console.log(`Fetched ${data.items?.length || 0} campaigns (skip: ${skip})`)
      
      // De v2 API retourneert een object met een 'items' array die de campaigns bevat
      if (data.items && Array.isArray(data.items)) {
        allCampaigns = [...allCampaigns, ...data.items]
        
        // Check if there are more campaigns to fetch
        if (data.items.length < limit) {
          hasMore = false
        } else {
          skip += limit
        }
      } else {
        hasMore = false
      }
      
      // Safety check to prevent infinite loops
      if (skip >= 1000) {
        console.warn("Reached maximum campaign limit of 1000")
        hasMore = false
      }
    }
    
    console.log(`Total campaigns fetched: ${allCampaigns.length}`)
    
    // Map all campaigns to the desired format
    const campaigns = allCampaigns.map((campaign: any) => ({
      id: campaign.id || "",
      name: campaign.name || "",
      status: campaign.status || ""
    }))
    
    console.log("Mapped campaigns count:", campaigns.length)
    return NextResponse.json({ campaigns, total: campaigns.length })
  } catch (e) {
    console.error("Error fetching Instantly campaigns:", e)
    return NextResponse.json({ error: e?.toString() }, { status: 500 })
  }
}

// No authentication needed for this endpoint - it only fetches campaign list
