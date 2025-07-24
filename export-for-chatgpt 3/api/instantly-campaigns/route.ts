import { NextResponse } from "next/server"

const INSTANTLY_API_KEY = "ZmVlNjJlZjktNWQwMC00Y2JmLWFiNmItYmU4YTk1YWEyMGE0OlFFeFVoYk9Ra1FXbw=="

export async function GET() {
  try {
    console.log("API: Starting to fetch Instantly campaigns...")
    
    // Gebruik de v2 API met Bearer token authentication
    const url = "https://api.instantly.ai/api/v2/campaigns"
    console.log("Fetching from:", url)
    
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${INSTANTLY_API_KEY}`,
        "Content-Type": "application/json"
      }
    })
    
    if (!res.ok) {
      const text = await res.text();
      console.error("Instantly API error:", res.status, text)
      return NextResponse.json({ error: "Fout bij ophalen Instantly campagnes", details: text }, { status: 500 })
    }
    
    const data = await res.json()
    console.log("Instantly API response:", data)
    
    // De v2 API retourneert een object met een 'items' array die de campaigns bevat
    let campaigns = [];
    if (data.items && Array.isArray(data.items)) {
      campaigns = data.items.map((campaign: any) => ({
        id: campaign.id || "",
        name: campaign.name || "",
        status: campaign.status || ""
      }))
    }
    
    console.log("Mapped campaigns:", campaigns)
    return NextResponse.json({ campaigns })
  } catch (e) {
    console.error("Error fetching Instantly campaigns:", e)
    return NextResponse.json({ error: e?.toString() }, { status: 500 })
  }
}
