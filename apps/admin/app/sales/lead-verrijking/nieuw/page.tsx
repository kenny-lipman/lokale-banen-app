import { LeadFormStap1 } from '@/components/sales/lead-form-stap1'

export default function NieuweLeadPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Lead Verrijking — Stap 1</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Voer URL en dealeigenaar in. Verrijking start direct na opslaan.
        </p>
      </div>
      <LeadFormStap1 />
    </div>
  )
}
