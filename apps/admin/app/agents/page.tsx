import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bot, Sparkles } from "lucide-react"

export default function AgentsOverviewPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Agents overzicht</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex items-center gap-x-3">
            <div className="size-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <Bot className="size-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Otis</CardTitle>
              <CardDescription>Job vacancy scraping and management agent</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/agents/otis/enhanced" className="text-orange-600 hover:underline font-semibold">
              Bekijk Otis Agent
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex items-center gap-x-3">
            <div className="size-10 bg-slate-900 rounded-lg flex items-center justify-center">
              <Sparkles className="size-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">AI publicatiechat</CardTitle>
              <CardDescription>Claude-chat voor vacaturepublicatie en read-only controles</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/agents/ai-chat" className="text-orange-600 hover:underline font-semibold">
              Open AI chat
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
