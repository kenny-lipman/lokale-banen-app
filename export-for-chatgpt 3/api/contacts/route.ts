import { NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"

export async function GET() {
  try {
    console.log("API: Starting to fetch contacts...")
    
    // Eerst een count query om te zien hoeveel contacten er zijn
    const { count } = await supabaseService.client.from("contacts").select("*", { count: 'exact', head: true })
    console.log("API: Total contacts in database:", count)
    
    const data = await supabaseService.getContacts()
    console.log("API: Successfully fetched contacts:", data?.length || 0, "contacts")
    return NextResponse.json(data)
  } catch (e) {
    console.error("API: Error fetching contacts:", e)
    const errorMessage = e instanceof Error ? e.message : "Unknown error"
    const errorStack = e instanceof Error ? e.stack : undefined
    return NextResponse.json({ 
      error: errorMessage, 
      details: String(e),
      stack: errorStack 
    }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const { contactIds, campaignId, campaignName } = await req.json();
    if (!Array.isArray(contactIds) || !campaignId) {
      return NextResponse.json({ error: "contactIds[] en campaignId vereist" }, { status: 400 });
    }
    // Dedupliceer contactIds eerst om dubbele verwerking te voorkomen
    const uniqueContactIds = [...new Set(contactIds)];
    console.log(`Originele contactIds: ${contactIds.length}, na deduplicatie: ${uniqueContactIds.length}`);
    
    // Haal alle contacten op uit Supabase
    const contacts = await supabaseService.getContacts();
    const selectedContacts = contacts.filter(c => uniqueContactIds.includes(c.id));
    
    console.log(`Gevonden contacten: ${selectedContacts.length} van ${uniqueContactIds.length} gevraagde IDs`);
    const results = [];
    const processedContactIds = new Set(); // Track processed contacts to prevent duplicates
    
    for (const contact of selectedContacts) {
      // Skip if we've already processed this contact
      if (processedContactIds.has(contact.id)) {
        console.log(`Skipping duplicate contact: ${contact.id}`);
        continue;
      }
      processedContactIds.add(contact.id);
      // Valideer email voordat we de API call maken
      if (!contact.email || contact.email.trim() === '') {
        results.push({ 
          contactId: contact.id, 
          error: `Contact ${contact.name || contact.id} heeft geen geldig e-mailadres`, 
          status: "error" 
        });
        continue;
      }

      // Valideer email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact.email)) {
        results.push({ 
          contactId: contact.id, 
          error: `Contact ${contact.name || contact.id} heeft een ongeldig e-mailadres: ${contact.email}`, 
          status: "error" 
        });
        continue;
      }

      // Bouw de body voor Instantly
      const body = {
        campaign: campaignId,
        email: contact.email.trim(),
        personalization: "", // Vul aan indien gewenst
        website: contact.companies?.website || "",
        last_name: contact.name?.split(" ").slice(-1)[0] || "",
        first_name: contact.name?.split(" ").slice(0, -1).join(" ") || contact.name || "",
        company_name: contact.companies?.name || "",
        phone: "",
        lt_interest_status: 1,
        pl_value_lead: "High",
        list_id: "560405f8-7aad-49c0-87ad-d9f023f734c9", // <-- Toegankelijke lijst
        assigned_to: "f191f0de-3753-4ce6-ace1-c1ed1b8a903e", // Vul aan indien gewenst
        skip_if_in_workspace: true,
        skip_if_in_campaign: true,
        skip_if_in_list: true,
        blocklist_id: "0197f015-b9b3-73e0-bfb1-0436a519afbb",
        verify_leads_for_lead_finder: false,
        verify_leads_on_import: false
      };
      
      // POST naar Instantly
      let instantlyId = null;
      let instantlyResponse = null;
      try {
        const res = await fetch("https://api.instantly.ai/api/v2/leads", {
          method: "POST",
          headers: {
            "Authorization": "Bearer ZmVlNjJlZjktNWQwMC00Y2JmLWFiNmItYmU4YTk1YWEyMGE0OlFFeFVoYk9Ra1FXbw==",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        instantlyResponse = await res.json();
        if (res.ok && instantlyResponse.id) {
          instantlyId = instantlyResponse.id;
          // Update contact in Supabase
          await supabaseService.updateContactCampaignInfo(contact.id, instantlyId, campaignName || "");
          results.push({ contactId: contact.id, instantlyId, status: "success", contactName: contact.name || contact.email });
        } else {
          results.push({ 
            contactId: contact.id, 
            error: instantlyResponse?.message || instantlyResponse?.error || "Onbekende fout van Instantly API", 
            status: "error",
            contactName: contact.name || contact.email
          });
        }
      } catch (err) {
        results.push({ 
          contactId: contact.id, 
          error: `Netwerkfout: ${err?.toString()}`, 
          status: "error",
          contactName: contact.name || contact.email
        });
      }
    }
    // Toon een duidelijke success of error message
    const successCount = results.filter(r => r.status === "success").length;
    const errorCount = results.filter(r => r.status === "error").length;
    
    if (successCount > 0 && errorCount === 0) {
      return NextResponse.json({ 
        results, 
        message: `✅ Alle ${successCount} contacten succesvol toegevoegd aan campagne "${campaignName}".` 
      });
    } else if (successCount > 0 && errorCount > 0) {
      return NextResponse.json({ 
        results, 
        message: `⚠️ ${successCount} contacten toegevoegd aan "${campaignName}", ${errorCount} mislukt.`,
        warning: true
      });
    } else {
      // Geef meer details over waarom alle contacten mislukten
      const errorMessages = results.map(r => r.error).filter(Boolean);
      const uniqueErrors = [...new Set(errorMessages)];
      return NextResponse.json({ 
        results, 
        error: `❌ Toevoegen mislukt voor alle ${results.length} contacten. Hoofdoorzaken: ${uniqueErrors.slice(0, 2).join(', ')}.` 
      }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e?.toString() }, { status: 500 });
  }
} 