import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Mail } from 'lucide-react'

export default function LeadVerrijkingPage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Verrijking</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Verrijk een bedrijf op basis van URL → review → sync naar Pipedrive.
          </p>
        </div>
        <Button asChild>
          <Link href="/sales/lead-verrijking/nieuw">
            <Plus className="w-4 h-4 mr-1" />
            Nieuwe lead
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-orange-600" />
            <CardTitle>Run-historie</CardTitle>
          </div>
          <CardDescription>De lijst met eerdere verrijkingen wordt opgeleverd in fase 6.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Gebruik <span className="font-mono">/sales/lead-verrijking/[run_id]</span> direct als je een specifieke run wilt openen.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
