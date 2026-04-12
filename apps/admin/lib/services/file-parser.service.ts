/**
 * File Parser Service
 * Handles parsing of CSV and Excel files for blocklist imports
 */

interface ParsedBlocklistEntry {
  type: 'email' | 'domain'
  value: string
  reason: string
  row: number // For error reporting
}

interface ParseResult {
  entries: ParsedBlocklistEntry[]
  errors: Array<{
    row: number
    message: string
  }>
  totalRows: number
}

export class FileParserService {
  /**
   * Parse uploaded file based on its type
   */
  async parseFile(file: File): Promise<ParseResult> {
    const fileName = file.name.toLowerCase()

    if (fileName.endsWith('.csv')) {
      return this.parseCSV(file)
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return this.parseExcel(file)
    } else {
      throw new Error('Unsupported file format. Please use .csv files.')
    }
  }

  /**
   * Parse CSV file (server-side)
   */
  private async parseCSV(file: File): Promise<ParseResult> {
    try {
      // Convert File to text using arrayBuffer (Node.js compatible)
      const arrayBuffer = await file.arrayBuffer()
      const csv = new TextDecoder('utf-8').decode(arrayBuffer)
      const lines = csv.split('\n').filter(line => line.trim())

      if (lines.length === 0) {
        return { entries: [], errors: [{ row: 1, message: 'File is empty' }], totalRows: 0 }
      }

      // Parse header
      const headerLine = lines[0]
      const headers = headerLine.split(',').map(h => h.trim().toLowerCase())

      const typeIndex = headers.findIndex(h => h.includes('type'))
      const valueIndex = headers.findIndex(h => h.includes('value') || h.includes('email') || h.includes('domain'))
      const reasonIndex = headers.findIndex(h => h.includes('reason') || h.includes('description') || h.includes('desc'))

      if (typeIndex === -1 || valueIndex === -1) {
        return {
          entries: [],
          errors: [{ row: 1, message: 'Required columns missing: type and value columns required' }],
          totalRows: lines.length - 1
        }
      }

      const entries: ParsedBlocklistEntry[] = []
      const errors: Array<{ row: number; message: string }> = []

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const rowNumber = i + 1

        const type = values[typeIndex]?.toLowerCase()
        const value = values[valueIndex]?.toLowerCase()
        const reason = values[reasonIndex] || 'Imported from CSV'

        if (!type || !value) {
          errors.push({ row: rowNumber, message: 'Missing required fields: type and value' })
          continue
        }

        if (type !== 'email' && type !== 'domain') {
          errors.push({ row: rowNumber, message: 'Invalid type: must be "email" or "domain"' })
          continue
        }

        entries.push({
          type: type as 'email' | 'domain',
          value,
          reason,
          row: rowNumber
        })
      }

      return { entries, errors, totalRows: lines.length - 1 }
    } catch (error) {
      return {
        entries: [],
        errors: [{ row: 1, message: `CSV parsing error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        totalRows: 0
      }
    }
  }

  /**
   * Parse Excel file (.xlsx/.xls) - Simplified for now, only supports CSV
   */
  private async parseExcel(file: File): Promise<ParseResult> {
    // For now, return an error suggesting CSV format
    return {
      entries: [],
      errors: [{
        row: 1,
        message: 'Excel files not yet supported. Please convert to CSV format and try again.'
      }],
      totalRows: 0
    }
  }
}

// Export singleton instance
export const fileParserService = new FileParserService()