import 'server-only'

import { createServiceRoleClient } from '@/lib/supabase-server'

export interface CompanyEditData {
  id: string
  name: string
  website: string | null
  description: string | null
  logo_url: string | null
  linkedin_url: string | null
  kvk_number: string | null
  street: string | null
  city: string | null
  zipcode: string | null
  state: string | null
  country: string | null
  phone: string | null
  industry: string | null
  size_min: number | null
  size_max: number | null
  location: string | null
  status: string | null
  is_customer: boolean | null
  created_at: string | null
}

export async function getCompanyForEdit(id: string): Promise<CompanyEditData | null> {
  const supabase = createServiceRoleClient()

  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !company) {
    return null
  }

  // De UI-form gebruikt single-string `industry`, `kvk_number`, `street`, `zipcode` -
  // remap zodat de bewerken-pagina ongewijzigd blijft. DB heeft `industries: text[]`,
  // `kvk`, `street_address`, `postal_code`.
  return {
    id: company.id,
    name: company.name,
    website: company.website,
    description: company.description,
    logo_url: company.logo_url,
    linkedin_url: company.linkedin_url,
    kvk_number: company.kvk,
    street: company.street_address,
    city: company.city,
    zipcode: company.postal_code,
    state: company.state,
    country: company.country,
    phone: company.phone,
    industry: company.industries?.[0] ?? null,
    size_min: company.size_min,
    size_max: company.size_max,
    location: company.location,
    status: company.status,
    is_customer: company.is_customer,
    created_at: company.created_at,
  }
}
