interface ParsedEntry {
  value: string
  reason: string
}

export async function parseCSVFile(file: File): Promise<ParsedEntry[]> {
  const text = await file.text()
  const lines = text.split('\n').filter(line => line.trim())

  if (lines.length === 0) {
    throw new Error('File is empty')
  }

  // Check if first line is a header
  const firstLine = lines[0].toLowerCase()
  const hasHeaders = firstLine.includes('value') || firstLine.includes('email') || firstLine.includes('domein') || firstLine.includes('reason') || firstLine.includes('reden')

  const dataLines = hasHeaders ? lines.slice(1) : lines
  const entries: ParsedEntry[] = []

  for (const line of dataLines) {
    if (!line.trim()) continue

    // Split by comma, but handle quoted values
    const columns = parseCSVLine(line)

    if (columns.length >= 2) {
      const value = columns[0].trim()
      const reason = columns[1].trim()

      if (value && reason) {
        entries.push({ value, reason })
      }
    } else if (columns.length === 1) {
      // Single column - assume it's the value with default reason
      const value = columns[0].trim()
      if (value) {
        entries.push({
          value,
          reason: 'Geïmporteerd uit bestand'
        })
      }
    }
  }

  return entries
}

function parseCSVLine(line: string): string[] {
  const result = []
  let current = ''
  let inQuotes = false
  let i = 0

  while (i < line.length) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"'
        i += 2
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes
        i++
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current)
      current = ''
      i++
    } else {
      current += char
      i++
    }
  }

  result.push(current)
  return result
}