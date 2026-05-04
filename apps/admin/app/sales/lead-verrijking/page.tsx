import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail } from "lucide-react"

export default function LeadVerrijkingPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Lead Verrijking</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Verrijk een bedrijf op basis van URL → review → sync naar Pipedrive
        </p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-orange-600" />
            <CardTitle>In ontwikkeling</CardTitle>
          </div>
          <CardDescription>
            Deze pagina wordt opgeleverd in fase 4 + 6 (run-historie + nieuwe lead).
            Het foundation-werk (database, sidebar) is klaar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Spec:{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded">
              docs/superpowers/specs/2026-05-04-sales-lead-automation-design.md
            </code>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
