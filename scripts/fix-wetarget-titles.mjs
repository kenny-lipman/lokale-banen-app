import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
const INSTANTLY_BASE_URL = "https://api.instantly.ai/api/v2";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const NORMALIZE_PROMPT = `Je normaliseert vacaturetitels voor gebruik in een cold email zin zoals: "Ik zag jullie vacature [titel] voorbijkomen".

REGELS:
- Maximaal 1-2 woorden (bij uitzondering 3 als het echt nodig is)
- Verwijder ALLES behalve de kernfunctie
- Verwijder: specialisatie, afdeling, branche, locatie, regio, senioriteit, werktype, uren, m/v/x
- "Elektromonteur Woningbouw en Utiliteit" → "Elektromonteur"
- "Servicemonteur W- / HVAC-installaties" → "Servicemonteur"
- "Logistiek Medewerker Luchtvracht" → "Logistiek Medewerker"
- "Monteur Technische Dienst" → "Monteur"
- "Orderpicker Wild & Gevogelte" → "Orderpicker"
- "Werkvoorbereider Elektrotechniek" → "Werkvoorbereider"
- "Teamleider Logistiek" → "Teamleider Logistiek" (kernfunctie, mag)
- "Chauffeur CE" → "Chauffeur CE" (CE is essentieel)
- "Vrachtwagenchauffeur" → "Chauffeur CE"
- "Magazijnmedewerker (Allround - Uden)" → "Magazijnmedewerker"
- "Eerste Monteur Elektrotechniek" → "Monteur"
- "Senior Werkvoorbereider" → "Werkvoorbereider"
- "Allround logistiek medewerker" → "Logistiek Medewerker"
- "Nachtchauffeur CE - Netwerktransport" → "Chauffeur CE"

Output JSON object met originele titel als key en genormaliseerde als value:
{"originele titel": "genormaliseerde titel", ...}`;

async function normalizeBatch(titles) {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: "mistral-medium-latest",
      messages: [
        { role: "system", content: NORMALIZE_PROMPT },
        { role: "user", content: `Normaliseer deze titels:\n${JSON.stringify(titles)}` },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
      temperature: 0.2,
    }),
  });

  if (response.status === 429) {
    console.log("  Rate limited, waiting 3s...");
    await delay(3000);
    return normalizeBatch(titles);
  }

  if (!response.ok) throw new Error(`Mistral ${response.status}`);

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

async function updateInstantlyLead(leadId, normalizedTitle, existingPayload) {
  const response = await fetch(`${INSTANTLY_BASE_URL}/leads/${leadId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${INSTANTLY_API_KEY}`,
    },
    body: JSON.stringify({
      custom_variables: {
        city: existingPayload.city || "",
        postal_code: existingPayload.postal_code || "",
        sector: existingPayload.sector || "",
        job_title: existingPayload.job_title || existingPayload.jobTitle || "",
        normalized_title: normalizedTitle,
      },
    }),
  });

  if (response.status === 429) {
    await delay(2000);
    return updateInstantlyLead(leadId, normalizedTitle, existingPayload);
  }

  if (!response.ok) throw new Error(`Instantly ${response.status}`);
  return response.json();
}

async function main() {
  // 1. Fetch all leads from Instantly for the 3 campaigns
  const campaignIds = [
    "f5422a62-0dff-493d-b6d2-fac4eef133a1", // Logistiek
    "df8d72a9-2472-400c-ba4b-332c59bf67ec", // Transport
    "a3664d52-7f83-4927-a088-493dddaf36d3", // Techniek
  ];

  console.log("Fetching leads from Instantly...");
  const allLeads = [];

  for (const campaignId of campaignIds) {
    let cursor = null;
    do {
      const body = { campaign: campaignId, limit: 100 };
      if (cursor) body.starting_after = cursor;

      const response = await fetch(`${INSTANTLY_BASE_URL}/leads/list`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${INSTANTLY_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) break;
      const data = await response.json();
      for (const lead of data.items || []) {
        allLeads.push({
          id: lead.id,
          email: lead.email,
          job_title: lead.job_title || lead.payload?.jobTitle || "",
          payload: lead.payload || {},
        });
      }
      cursor = data.next_starting_after || null;
    } while (cursor);
  }

  console.log(`Fetched ${allLeads.length} leads from 3 campaigns\n`);

  // 2. Collect unique job titles
  const uniqueTitles = [...new Set(allLeads.map((l) => l.job_title).filter(Boolean))];
  console.log(`Found ${uniqueTitles.length} unique job titles to normalize\n`);

  // 3. Normalize in batches of 15
  const titleMap = {};
  for (let i = 0; i < uniqueTitles.length; i += 15) {
    const batch = uniqueTitles.slice(i, i + 15);
    console.log(`  Normalizing batch ${Math.floor(i / 15) + 1}/${Math.ceil(uniqueTitles.length / 15)} (${batch.length} titles)...`);

    try {
      const result = await normalizeBatch(batch);
      Object.assign(titleMap, result);
    } catch (err) {
      console.error(`  Error: ${err.message}`);
      // Fallback: use originals
      for (const t of batch) titleMap[t] = t;
    }

    if (i + 15 < uniqueTitles.length) await delay(300);
  }

  console.log(`\nNormalized ${Object.keys(titleMap).length} titles. Samples:`);
  const samples = Object.entries(titleMap).slice(0, 10);
  for (const [orig, norm] of samples) {
    console.log(`  "${orig}" → "${norm}"`);
  }

  // 4. Update each lead in Instantly
  console.log(`\nUpdating ${allLeads.length} leads in Instantly...`);
  let updated = 0, errors = 0;

  for (let i = 0; i < allLeads.length; i++) {
    const lead = allLeads[i];
    const normalized = titleMap[lead.job_title] || lead.job_title;

    try {
      await updateInstantlyLead(lead.id, normalized, lead.payload);
      updated++;
    } catch (err) {
      errors++;
      if (errors <= 5) console.error(`  ✗ ${lead.email}: ${err.message}`);
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  [${i + 1}/${allLeads.length}] updated: ${updated}, errors: ${errors}`);
    }
    if (i % 5 === 4) await delay(200);
  }

  console.log(`\n=== DONE ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);
