/**
 * Shared contact service for all scrapers
 * Handles contact creation, lookup, and updates with 3-tier deduplication
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContactData, ContactResult } from "./types";
import { normalizePhone, parseName } from "./utils";

/**
 * Find or create a contact for a company
 *
 * Deduplication strategy (in order of reliability):
 * 1. Email (global) - most reliable unique identifier
 * 2. Phone + Company - same phone at same company = same person
 * 3. Name + Company - same name at same company = likely same person
 *
 * Also updates existing contacts with missing fields when found.
 *
 * @param supabase - Supabase client
 * @param companyId - Company ID to link contact to
 * @param contactData - Contact data to create/update
 * @param sourceName - Source name for new contacts (e.g., "De Banensite")
 * @returns ContactResult or null if no contact info provided
 */
export async function findOrCreateContact(
  supabase: SupabaseClient,
  companyId: string,
  contactData: ContactData,
  sourceName: string
): Promise<ContactResult | null> {
  // Need at least a name or email to create a contact
  if (!contactData.name && !contactData.email) {
    return null;
  }

  // Strategy 1: Check by email (global - most reliable)
  if (contactData.email) {
    const { data: existingByEmail } = await supabase
      .from("contacts")
      .select("id, phone, title")
      .eq("email", contactData.email)
      .single();

    if (existingByEmail) {
      const updates: Record<string, unknown> = {};
      if (contactData.phone && !existingByEmail.phone) updates.phone = contactData.phone;
      if (contactData.title && !existingByEmail.title) updates.title = contactData.title;

      if (Object.keys(updates).length > 0) {
        await supabase.from("contacts").update(updates).eq("id", existingByEmail.id);
      }
      return {
        id: existingByEmail.id,
        created: false,
        updated: Object.keys(updates).length > 0,
      };
    }
  }

  // Strategy 2: Check by phone + company
  if (contactData.phone) {
    const normalizedInputPhone = normalizePhone(contactData.phone);

    const { data: companyContacts } = await supabase
      .from("contacts")
      .select("id, phone, email, title, name")
      .eq("company_id", companyId);

    if (companyContacts) {
      const matchByPhone = companyContacts.find(
        (c) => c.phone && normalizePhone(c.phone) === normalizedInputPhone
      );

      if (matchByPhone) {
        const updates: Record<string, unknown> = {};
        if (contactData.email && !matchByPhone.email) updates.email = contactData.email;
        if (contactData.title && !matchByPhone.title) updates.title = contactData.title;
        if (contactData.name && !matchByPhone.name) updates.name = contactData.name;

        if (Object.keys(updates).length > 0) {
          await supabase.from("contacts").update(updates).eq("id", matchByPhone.id);
        }
        return {
          id: matchByPhone.id,
          created: false,
          updated: Object.keys(updates).length > 0,
        };
      }
    }
  }

  // Strategy 3: Check by name + company
  if (contactData.name) {
    const { data: existingByName } = await supabase
      .from("contacts")
      .select("id, phone, email, title")
      .eq("company_id", companyId)
      .ilike("name", contactData.name)
      .single();

    if (existingByName) {
      const updates: Record<string, unknown> = {};
      if (contactData.email && !existingByName.email) updates.email = contactData.email;
      if (contactData.phone && !existingByName.phone) updates.phone = contactData.phone;
      if (contactData.title && !existingByName.title) updates.title = contactData.title;

      if (Object.keys(updates).length > 0) {
        await supabase.from("contacts").update(updates).eq("id", existingByName.id);
      }
      return {
        id: existingByName.id,
        created: false,
        updated: Object.keys(updates).length > 0,
      };
    }
  }

  // No match found - create new contact
  const { firstName, lastName } = parseName(contactData.name || "");

  const { data: newContact, error } = await supabase
    .from("contacts")
    .insert({
      company_id: companyId,
      name: contactData.name || null,
      first_name: firstName,
      last_name: lastName,
      email: contactData.email || null,
      phone: contactData.phone || null,
      title: contactData.title || null,
      source: sourceName,
      qualification_status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error(`Failed to create contact: ${error.message}`);
    return null;
  }

  return newContact ? { id: newContact.id, created: true, updated: false } : null;
}
