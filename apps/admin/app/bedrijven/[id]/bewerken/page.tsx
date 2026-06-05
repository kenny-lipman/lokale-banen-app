import { redirect } from "next/navigation"
import { getCompanyForEdit } from "@/lib/companies/get-company-for-edit"
import { BewerkBedrijfForm } from "./bewerk-bedrijf-form"

export default async function BewerkBedrijfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const company = await getCompanyForEdit(id)
  if (!company) redirect("/companies")
  return <BewerkBedrijfForm id={id} initialData={company} />
}
