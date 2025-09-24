/**
 * Blocklist File Upload API Route
 * Handles file upload and parsing for blocklist imports
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { fileParserService } from '@/lib/services/file-parser.service'
import { importValidationService } from '@/lib/services/import-validation.service'
import { supabaseService } from "@/lib/supabase-service"

async function uploadHandler(req: NextRequest, authResult: AuthResult) {
  try {
    console.log(`User ${authResult.user.email} uploading blocklist file`)

    // Check if request contains multipart form data
    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Request must include multipart/form-data with file upload'
        },
        { status: 400 }
      )
    }

    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: 'No file provided. Please select a file to upload.'
        },
        { status: 400 }
      )
    }

    // Validate file type
    const fileName = file.name.toLowerCase()
    const supportedExtensions = ['.csv', '.xlsx', '.xls']
    const isSupported = supportedExtensions.some(ext => fileName.endsWith(ext))

    if (!isSupported) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type. Supported formats: ${supportedExtensions.join(', ')}`
        },
        { status: 400 }
      )
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024 // 5MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large. Maximum size is 5MB. Your file is ${Math.round(file.size / 1024 / 1024)}MB.`
        },
        { status: 400 }
      )
    }

    console.log(`Processing file: ${file.name}, size: ${Math.round(file.size / 1024)}KB`)

    // Parse the file
    let parseResult
    try {
      parseResult = await fileParserService.parseFile(file)
    } catch (error) {
      console.error('File parsing error:', error)
      return NextResponse.json(
        {
          success: false,
          error: `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown parsing error'}`
        },
        { status: 400 }
      )
    }

    // Validate parsed entries
    let validationResult
    try {
      validationResult = await importValidationService.validateEntries(parseResult.entries)
    } catch (error) {
      console.error('Validation error:', error)
      return NextResponse.json(
        {
          success: false,
          error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown validation error'}`
        },
        { status: 500 }
      )
    }

    // Prepare response
    const response = {
      success: true,
      message: 'File processed successfully',
      data: {
        filename: file.name,
        fileSize: file.size,
        parsing: {
          totalRows: parseResult.totalRows,
          parsedEntries: parseResult.entries.length,
          parseErrors: parseResult.errors
        },
        validation: {
          summary: validationResult.summary,
          validEntries: validationResult.validEntries.length,
          errors: validationResult.errors,
          duplicatesWithinFile: validationResult.duplicatesWithinFile,
          duplicatesWithDatabase: validationResult.duplicatesWithDatabase
        },
        // Include valid entries for import
        entriesForImport: importValidationService.filterValidEntries(
          validationResult.validEntries,
          validationResult.errors
        )
      },
      timestamp: new Date().toISOString()
    }

    console.log(`File processing complete: ${validationResult.validEntries.length} valid entries, ${validationResult.errors.length} issues`)

    // Now actually import the valid entries to database
    let importedCount = 0
    let importError = null

    const entriesToImport = importValidationService.filterValidEntries(
      validationResult.validEntries,
      validationResult.errors
    )

    if (entriesToImport.length > 0) {
      try {
        const supabase = supabaseService.serviceClient

        // Prepare entries for database insertion
        const dbEntries = entriesToImport.map(entry => ({
          type: entry.type,
          value: entry.value.toLowerCase(),
          reason: entry.reason,
          is_active: true
        }))

        const { data, error } = await supabase
          .from('blocklist_entries')
          .insert(dbEntries)
          .select()

        if (error) {
          console.error("Error inserting blocklist entries:", error)
          importError = error.message
        } else {
          importedCount = data?.length || 0
          console.log(`Successfully imported ${importedCount} entries to database`)
        }
      } catch (error) {
        console.error("Database import error:", error)
        importError = error instanceof Error ? error.message : 'Unknown database error'
      }
    }

    // Update response with import results
    response.data.import = {
      attempted: entriesToImport.length,
      successful: importedCount,
      failed: entriesToImport.length - importedCount,
      error: importError
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Upload API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during file processing',
        code: 'UPLOAD_PROCESSING_ERROR'
      },
      { status: 500 }
    )
  }
}

export const POST = withAuth(uploadHandler)