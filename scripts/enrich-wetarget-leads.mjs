import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
const INSTANTLY_BASE_URL = "https://api.instantly.ai/api/v2";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const SYSTEM_PROMPT = `Je bent een Nederlandse B2B copywriter gespecialiseerd in cold e-mail personalisatie voor WeTarget, een jobmarketing bureau.

## Over WeTarget:
- WeTarget doet jobmarketing: gerichte advertentiecampagnes voor vacatures
- Ze helpen bedrijven de juiste kandidaten te bereiken via data-driven ads
- Focus op recruitment marketing, employer branding en vacature-advertising
- Motto: "Driven by people. Focused on results."
- Ze maken vacatures zichtbaar bij de juiste doelgroep op het juiste moment
- Betaalbaar en meetbaar alternatief voor traditionele jobboards
- Klanten zijn o.a. Belisol, FrieslandCampina, Verkade Klimaat

## Jouw taken:

### 1. Vacaturetitel normaliseren
- Verwijder: bedrijfsnaam, locatie, regio, m/v/x, "gezocht", "gevraagd", "(fulltime)", uren, "BBL", "tijdelijk"
- Verwijder ook senioriteit: "Eerste", "Senior", "Junior", "Allround", "Ervaren", "Medior", "Hoofd", "Leerling"
- "Magazijnmedewerker (Allround - Uden)" → "Magazijnmedewerker"
- "Vrachtwagen Chauffeur CE - Haakarm (regio)" → "Chauffeur CE"
- "Servicemonteur W- / HVAC-installaties" → "Servicemonteur HVAC"
- "Eerste Monteur Elektrotechniek" → "Monteur Elektrotechniek"
- "Senior Werkvoorbereider Elektrotechniek" → "Werkvoorbereider Elektrotechniek"
- "Allround logistiek medewerker" → "Logistiek Medewerker"
- Hou het kort en herkenbaar

### 2. Personalisatie-alinea voor cold e-mail (BELANGRIJK)

**Context:** WeTarget benadert bedrijven die actief vacatures hebben openstaan. De email gaat over hoe WeTarget kan helpen met het vullen van die vacature via jobmarketing/vacature-ads.

**Doel:** Een kort, pakkend stukje tekst dat:
1. Direct herkenning creëert ("dit gaat over mijn vacature/bedrijf")
2. Laat zien dat we hun sector en uitdaging snappen
3. Subtiel aanstipt dat traditioneel werven (Indeed, LinkedIn) duur en inefficiënt kan zijn
4. Nieuwsgierigheid wekt naar jobmarketing als alternatief

**Regels:**
- MAX 60 woorden
- Nederlands, informeel-professioneel (je/jullie)
- Geen vragen stellen
- Geen "Ik zag dat...", "Ik kwam jullie tegen...", "Ik wilde even..."
- Geen superlatieven (beste, geweldig, fantastisch)
- Geen CTA of verkooppraatje
- Specifiek > generiek
- Noem de sector/functie, niet het bedrijf bij naam (tenzij het echt relevant is)

**Goede voorbeelden:**
- "Een goede magazijnmedewerker vinden is in de logistiek altijd een uitdaging. Zeker als je concurreert met distributiecentra die met grote volumes werven. Gerichte vacature-ads bereiken precies de mensen die niet actief zoeken maar wél openstaan voor iets nieuws."
- "CE-chauffeurs zijn schaars, dat weet iedereen in de transport. De meeste zitten al ergens, maar scrollen 's avonds wel door hun socials. Precies daar werkt jobmarketing het beste."
- "Technisch personeel werven via een jobboard levert vaak honderden ongeschikte reacties op. Monteurs en technici bereik je effectiever met gerichte ads op de plekken waar ze daadwerkelijk zijn."

**OUTPUT FORMAT (JSON):**
{
  "normalized_title": "string - Korte, genormaliseerde vacaturetitel",
  "personalization": "string - Cold e-mail personalisatie, max 60 woorden"
}`;

async function callMistral(company, jobTitle, city, sector) {
  const userPrompt = `Normaliseer de vacaturetitel en schrijf een personalisatie voor deze lead:

**Bedrijf:** ${company}
**Vacaturetitel:** ${jobTitle}
**Locatie:** ${city || "Onbekend"}
**Sector:** ${sector}

Genereer JSON output.`;

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: "mistral-medium-latest",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.85,
    }),
  });

  if (response.status === 429) {
    console.log("    Rate limited by Mistral, waiting 3s...");
    await delay(3000);
    return callMistral(company, jobTitle, city, sector);
  }

  if (!response.ok) {
    throw new Error(`Mistral ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return JSON.parse(content);
}

async function updateInstantlyLead(leadId, updates) {
  const response = await fetch(`${INSTANTLY_BASE_URL}/leads/${leadId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${INSTANTLY_API_KEY}`,
    },
    body: JSON.stringify(updates),
  });

  if (response.status === 429) {
    await delay(2000);
    return updateInstantlyLead(leadId, updates);
  }

  if (!response.ok) {
    throw new Error(`Instantly ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function main() {
  // Get all pushed leads from staging
  const { data: stagingLeads, error } = await supabase
    .from("wetarget_leads_staging")
    .select("*")
    .eq("pushed_to_instantly", true)
    .order("sector")
    .order("id");

  if (error) {
    console.error("Error:", error);
    process.exit(1);
  }

  console.log(`Found ${stagingLeads.length} leads to enrich\n`);

  // Get Instantly lead IDs by email per campaign
  const campaignIds = [
    "f5422a62-0dff-493d-b6d2-fac4eef133a1",
    "df8d72a9-2472-400c-ba4b-332c59bf67ec",
    "a3664d52-7f83-4927-a088-493dddaf36d3",
  ];

  // Build email→instantly_lead_id map by fetching from Instantly
  console.log("Fetching lead IDs from Instantly...");
  const emailToLeadId = {};

  for (const campaignId of campaignIds) {
    let cursor = null;
    let page = 0;
    do {
      const body = {
        campaign: campaignId,
        limit: 100,
      };
      if (cursor) body.starting_after = cursor;

      const response = await fetch(
        `${INSTANTLY_BASE_URL}/leads/list`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${INSTANTLY_API_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        console.error(`Error fetching leads: ${response.status}`);
        break;
      }

      const data = await response.json();
      for (const lead of data.items || []) {
        emailToLeadId[lead.email] = {
          id: lead.id,
          existing_custom_vars: lead.payload || {},
        };
      }

      cursor = data.next_starting_after || null;
      page++;
      if (page % 5 === 0) process.stdout.write(`  [${Object.keys(emailToLeadId).length} leads mapped] `);
    } while (cursor);
  }

  console.log(`\nMapped ${Object.keys(emailToLeadId).length} Instantly leads\n`);

  const stats = { enriched: 0, skipped: 0, errors: 0 };
  let currentSector = "";

  for (let i = 0; i < stagingLeads.length; i++) {
    const lead = stagingLeads[i];

    if (lead.sector !== currentSector) {
      currentSector = lead.sector;
      console.log(`\n=== ${currentSector} ===`);
    }

    const instantlyLead = emailToLeadId[lead.email];
    if (!instantlyLead) {
      stats.skipped++;
      continue;
    }

    try {
      // 1. Call Mistral
      const aiResult = await callMistral(
        lead.company_name,
        lead.job_title,
        lead.city,
        lead.sector
      );

      // 2. Update Instantly lead with personalization + normalized title in custom vars
      const existingVars = instantlyLead.existing_custom_vars;
      await updateInstantlyLead(instantlyLead.id, {
        personalization: aiResult.personalization || "",
        custom_variables: {
          city: existingVars.city || lead.city || "",
          postal_code: existingVars.postal_code || lead.postal_code || "",
          sector: existingVars.sector || lead.sector,
          job_title: lead.job_title || "",
          normalized_title: aiResult.normalized_title || "",
        },
      });

      stats.enriched++;

      if ((i + 1) % 25 === 0) {
        console.log(`  [${i + 1}/${stagingLeads.length}] enriched: ${stats.enriched}, errors: ${stats.errors}`);
      }
    } catch (err) {
      stats.errors++;
      console.error(`  ✗ ${lead.email}: ${err.message.slice(0, 120)}`);
    }

    // Rate limit: ~2 calls per second (Mistral + Instantly)
    if (i % 3 === 2) await delay(500);
  }

  console.log(`\n=== TOTAAL ===`);
  console.log(`Enriched: ${stats.enriched}`);
  console.log(`Skipped (not in Instantly): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
}

main().catch(console.error);
