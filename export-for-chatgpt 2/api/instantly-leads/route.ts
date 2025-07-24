import { NextResponse } from "next/server"

const INSTANTLY_API_KEY = "ZmVlNjJlZjktNWQwMC00Y2JmLWFiNmItYmU4YTk1YWEyMGE0OlFFeFVoYk9Ra1FXbw=="
const LEAD_LIST_ID = "2af5c1a6-bf57-4511-bb30-3eaa86e17104"

export async function GET() {
  try {
    const res = await fetch("https://api.instantly.ai/api/v2/leads/list", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${INSTANTLY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ list_id: LEAD_LIST_ID })
    })
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: "Fout bij ophalen Instantly leads", details: text }, { status: 500 })
    }
    const data = await res.json()
    // Map leads naar gewenste structuur
    const leads = (data.leads || []).map((lead: any) => ({
      name: lead.name || lead.first_name || "",
      email: lead.email || "",
      company_name: lead.company_name || lead.company || "",
      status: lead.status || lead.lead_status || ""
    }))
    return NextResponse.json(leads)
  } catch (e) {
    return NextResponse.json({ error: e?.toString() }, { status: 500 })
  }
} 