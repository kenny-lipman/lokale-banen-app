import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
const BASE_URL = "https://api.instantly.ai/api/v2";

const CAMPAIGNS = {
  LOGISTIEK: "f5422a62-0dff-493d-b6d2-fac4eef133a1",
  TRANSPORT: "df8d72a9-2472-400c-ba4b-332c59bf67ec",
  TECHNIEK: "a3664d52-7f83-4927-a088-493dddaf36d3",
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function createLead(leadData) {
  const response = await fetch(`${BASE_URL}/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${INSTANTLY_API_KEY}`,
    },
    body: JSON.stringify(leadData),
  });

  if (response.status === 429) {
    console.log("    Rate limited, waiting 2s...");
    await delay(2000);
    return createLead(leadData);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status}: ${errorText}`);
  }

  return response.json();
}

async function main() {
  console.log("Fetching leads from staging table...");

  const { data: leads, error } = await supabase
    .from("wetarget_leads_staging")
    .select("*")
    .eq("pushed_to_instantly", false)
    .order("sector")
    .order("job_created_at", { ascending: false });

  if (error) {
    console.error("Error:", error);
    process.exit(1);
  }

  console.log(`Found ${leads.length} leads to push\n`);

  const stats = { added: 0, skipped: 0, errors: 0 };

  for (const [sector, campaignId] of Object.entries(CAMPAIGNS)) {
    const sectorLeads = leads.filter((l) => l.sector === sector);
    console.log(`\n=== ${sector}: ${sectorLeads.length} leads ===`);

    for (let i = 0; i < sectorLeads.length; i++) {
      const lead = sectorLeads[i];

      try {
        const result = await createLead({
          campaign: campaignId,
          email: lead.email,
          first_name: lead.first_name || "",
          last_name: lead.last_name || "",
          company_name: lead.company_name || "",
          skip_if_in_campaign: true,
          skip_if_in_workspace: true,
          custom_variables: {
            city: lead.city || "",
            postal_code: lead.postal_code || "",
            job_title: lead.job_title || "",
            sector: sector.charAt(0) + sector.slice(1).toLowerCase(),
          },
        });

        // Mark as pushed
        await supabase
          .from("wetarget_leads_staging")
          .update({ pushed_to_instantly: true })
          .eq("id", lead.id);

        // Update contact
        await supabase
          .from("contacts")
          .update({
            campaign_id: campaignId,
            campaign_name: `WeTarget (${sector.charAt(0) + sector.slice(1).toLowerCase()})`,
            qualification_status: "in_campaign",
          })
          .eq("id", lead.contact_id);

        if (result.skipped) {
          stats.skipped++;
          if ((i + 1) % 50 === 0) process.stdout.write(`  [${i + 1}/${sectorLeads.length}] `);
        } else {
          stats.added++;
          if ((i + 1) % 50 === 0) process.stdout.write(`  [${i + 1}/${sectorLeads.length}] `);
        }
      } catch (err) {
        stats.errors++;
        console.error(`  ✗ ${lead.email}: ${err.message.slice(0, 100)}`);
      }

      // Small delay to avoid rate limits
      if (i % 5 === 4) await delay(200);
    }

    console.log(`  Done: ${sector}`);
  }

  console.log(`\n=== TOTAAL ===`);
  console.log(`Added: ${stats.added}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
}

main().catch(console.error);
