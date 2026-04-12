import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { detectBlockType, BlockType } from '@/lib/blocklist-detection'
import { parseCSVFile } from '@/lib/csv-parser'

interface DetectionPreview {
  value: string
  reason: string
  detected_type: 'email' | 'domain' | 'company'
  confidence: 'high' | 'medium' | 'low'
  warning?: string
}

async function previewHandler(req: NextRequest, authResult: AuthResult) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Parse the file
    const entries = await parseCSVFile(file)

    if (!entries || entries.length === 0) {
      return NextResponse.json(
        { error: "No valid data found in file" },
        { status: 400 }
      )
    }

    // Process first 50 entries for preview (to avoid performance issues)
    const previewEntries = entries.slice(0, 50)
    const preview: DetectionPreview[] = []

    for (const entry of previewEntries) {
      try {
        const detection = detectBlockType(entry.value)
        let detectedType: 'email' | 'domain' | 'company'
        let confidence: 'high' | 'medium' | 'low' = 'high'
        let warning: string | undefined

        switch (detection.type) {
          case BlockType.EMAIL:
            detectedType = 'email'
            break
          case BlockType.COMPANY:
            detectedType = 'company'
            confidence = 'medium' // Company detection is less certain
            break
          case BlockType.DOMAIN:
            detectedType = 'domain'
            break
          default:
            detectedType = 'domain'
            confidence = 'low'
            warning = 'Kon type niet automatisch detecteren'
        }

        // Additional validation warnings
        if (detection.type === BlockType.COMPANY && !detection.normalized_value.includes('.')) {
          warning = 'Bedrijf niet gevonden - wordt als domein toegevoegd'
        }

        if (entry.value !== detection.normalized_value) {
          warning = warning ? `${warning}; Waarde genormaliseerd` : 'Waarde wordt genormaliseerd'
        }

        preview.push({
          value: entry.value,
          reason: entry.reason,
          detected_type: detectedType,
          confidence,
          warning
        })
      } catch (error) {
        // If detection fails, default to domain with low confidence
        preview.push({
          value: entry.value,
          reason: entry.reason,
          detected_type: 'domain',
          confidence: 'low',
          warning: 'Detectie gefaald - wordt als domein behandeld'
        })
      }
    }

    return NextResponse.json({
      success: true,
      preview,
      total: entries.length,
      showing: preview.length
    })

  } catch (error) {
    console.error("Preview API error:", error)
    return NextResponse.json(
      { error: "Could not analyze file" },
      { status: 500 }
    )
  }
}

export const POST = withAuth(previewHandler)