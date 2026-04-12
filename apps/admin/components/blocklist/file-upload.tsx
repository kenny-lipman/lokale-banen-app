"use client"

import { useState, useCallback, useRef, DragEvent } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Upload,
  FileText,
  X,
  AlertCircle,
  Download,
  CheckCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface FileUploadProps {
  onFileSelect: (file: File) => void
  loading?: boolean
  error?: string | null
  onClearError?: () => void
  className?: string
}

const SUPPORTED_FORMATS = [".csv"]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function FileUpload({
  onFileSelect,
  loading,
  error,
  onClearError,
  className,
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [isDragReject, setIsDragReject] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isValidFileType = (file: File) => {
    const validTypes = [
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ]
    return validTypes.includes(file.type) || SUPPORTED_FORMATS.some(ext => file.name.toLowerCase().endsWith(ext))
  }

  const validateFile = (file: File) => {
    if (!isValidFileType(file)) {
      return `Ongeldig bestandstype. Ondersteunde formaten: ${SUPPORTED_FORMATS.join(", ")}`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Bestand te groot: ${formatFileSize(file.size)} (max ${formatFileSize(MAX_FILE_SIZE)})`
    }
    return null
  }

  const handleFile = (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setFileError(validationError)
      return
    }

    setSelectedFile(file)
    setFileError(null)
    onFileSelect(file)
    onClearError?.()
  }

  const onDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)

    // Check if dragged items contain valid files
    const items = Array.from(e.dataTransfer?.items || [])
    const hasInvalidFile = items.some(item => {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        return file && validateFile(file) !== null
      }
      return false
    })
    setIsDragReject(hasInvalidFile)
  }, [])

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
    setIsDragReject(false)
  }, [])

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
    setIsDragReject(false)

    const files = Array.from(e.dataTransfer?.files || [])
    if (files.length > 0) {
      handleFile(files[0])
    }
  }, [])

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      handleFile(files[0])
    }
  }

  const clearSelectedFile = () => {
    setSelectedFile(null)
    setFileError(null)
    onClearError?.()
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getFileIcon = (filename: string) => {
    return <FileText className="h-8 w-8 text-blue-500" />
  }

  const downloadTemplate = () => {
    const csvContent = `type,value,reason
email,spam@example.com,Spam email address
domain,spam-domain.com,Known spam domain
email,test@blocked.com,Blocked for testing
domain,malicious-site.org,Malicious domain`

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "blocklist-template.csv"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const currentError = error || fileError

  return (
    <div className={cn("space-y-4", className)}>
      {/* Template Download */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Importeer Blocklist</h3>
          <p className="text-xs text-muted-foreground">
            Upload een CSV bestand met email adressen en domeinen
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={downloadTemplate}
          className="text-xs"
        >
          <Download className="h-3 w-3 mr-1" />
          Template
        </Button>
      </div>

      {/* File Upload Area */}
      <Card
        className={cn(
          "transition-colors duration-200",
          {
            "border-dashed border-2": !selectedFile,
            "border-primary bg-primary/5": isDragActive && !isDragReject,
            "border-red-500 bg-red-50": isDragReject || !!currentError,
            "border-green-500 bg-green-50": selectedFile && !currentError,
            "cursor-pointer": !selectedFile,
          }
        )}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={!selectedFile ? handleClick : undefined}
      >
        <CardContent className="p-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={onFileInputChange}
            className="hidden"
          />

          {selectedFile ? (
            <div className="space-y-4">
              {/* Selected File Display */}
              <div className="flex items-center gap-3">
                {getFileIcon(selectedFile.name)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelectedFile}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Success State */}
              {!currentError && !loading && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">Bestand geselecteerd</span>
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm">Bestand wordt verwerkt...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 space-y-4">
              <div className="flex justify-center">
                <Upload
                  className={cn("h-8 w-8", {
                    "text-primary": isDragActive && !isDragReject,
                    "text-red-500": isDragReject,
                    "text-muted-foreground": !isDragActive,
                  })}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {isDragActive
                    ? isDragReject
                      ? "Bestandstype niet ondersteund"
                      : "Drop je bestand hier"
                    : "Sleep je bestand hierheen of klik om te uploaden"}
                </p>
                <div className="flex justify-center gap-1">
                  {SUPPORTED_FORMATS.map((format) => (
                    <Badge key={format} variant="secondary" className="text-xs">
                      {format}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Maximum bestandsgrootte: {formatFileSize(MAX_FILE_SIZE)}
                </p>
              </div>
            </div>
          )}

          {/* Error Display */}
          {currentError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Fout</span>
              </div>
              <div className="mt-1">
                <p className="text-sm text-red-600">{currentError}</p>
              </div>
            </div>
          )}

          {/* Format Help */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="text-sm font-medium text-blue-800 mb-1">
              Verwachte bestandsindeling:
            </h4>
            <div className="text-xs text-blue-700 space-y-1">
              <p>
                <strong>Kolommen:</strong> type, value, reason
              </p>
              <p>
                <strong>Type:</strong> "email" of "domain"
              </p>
              <p>
                <strong>Voorbeeld:</strong> email, spam@example.com, Spam address
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}