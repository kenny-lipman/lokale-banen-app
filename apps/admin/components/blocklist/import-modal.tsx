"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileUpload } from "./file-upload"
import { CheckCircle, AlertCircle, Info, Eye, EyeOff } from "lucide-react"

interface DetectionPreview {
  value: string
  reason: string
  detected_type: 'email' | 'domain' | 'company'
  confidence: 'high' | 'medium' | 'low'
  warning?: string
}

interface ImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (file: File) => Promise<void>
  loading?: boolean
}

export function ImportModal({
  open,
  onOpenChange,
  onImport,
  loading = false,
}: ImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [previewData, setPreviewData] = useState<DetectionPreview[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file)
    setError(null)
    setSuccess(false)
    setPreviewData([])
    setShowPreview(false)

    // Start analyzing the file for preview
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      await analyzeFile(file)
    }
  }

  const analyzeFile = async (file: File) => {
    setIsAnalyzing(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      // Call a preview API endpoint (we'll create this)
      const response = await fetch('/api/blocklist/preview', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setPreviewData(data.preview || [])
        setShowPreview(true)
      }
    } catch (err) {
      console.error('Preview analysis failed:', err)
      // Don't show error for preview failures - just skip preview
    } finally {
      setIsAnalyzing(false)
    }
  }

  const togglePreview = () => {
    setShowPreview(!showPreview)
  }

  const handleImport = async () => {
    if (!selectedFile) return

    try {
      setError(null)
      await onImport(selectedFile)
      setSuccess(true)
      setTimeout(() => {
        handleClose()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
    }
  }

  const handleClose = () => {
    if (!loading) {
      setSelectedFile(null)
      setError(null)
      setSuccess(false)
      onOpenChange(false)
    }
  }

  const handleClearError = () => {
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Blocklist Importeren</DialogTitle>
          <DialogDescription>
            Upload een CSV of Excel bestand om meerdere entries tegelijk toe te voegen aan de blocklist.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {success ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center space-y-3">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold text-green-700">
                    Import Succesvol!
                  </h3>
                  <p className="text-sm text-green-600">
                    Het bestand is succesvol geïmporteerd.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <FileUpload
                onFileSelect={handleFileSelect}
                loading={loading}
                error={error}
                onClearError={handleClearError}
              />

              {/* Preview Section */}
              {(previewData.length > 0 || isAnalyzing) && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Detectie Voorvertoning</CardTitle>
                      <div className="flex items-center gap-2">
                        {isAnalyzing && (
                          <Badge variant="secondary" className="animate-pulse">
                            Analyseren...
                          </Badge>
                        )}
                        {previewData.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={togglePreview}
                            className="h-8 px-2"
                          >
                            {showPreview ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-1" />
                                Verbergen
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-1" />
                                Tonen ({previewData.length})
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                    <CardDescription>
                      Automatische detectie van e-mails, domeinen en bedrijven
                    </CardDescription>
                  </CardHeader>
                  {showPreview && previewData.length > 0 && (
                    <CardContent className="pt-0">
                      <ScrollArea className="h-32 w-full border rounded-md">
                        <div className="p-3 space-y-2">
                          {previewData.slice(0, 10).map((item, index) => (
                            <div key={index} className="flex items-start justify-between gap-2 text-sm">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{item.value}</div>
                                <div className="text-muted-foreground text-xs truncate">{item.reason}</div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Badge
                                  variant={
                                    item.detected_type === 'email' ? 'default' :
                                    item.detected_type === 'company' ? 'secondary' : 'outline'
                                  }
                                  className="text-xs px-1.5 py-0"
                                >
                                  {item.detected_type}
                                </Badge>
                                {item.confidence === 'high' ? (
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                ) : item.confidence === 'medium' ? (
                                  <Info className="h-3 w-3 text-yellow-500" />
                                ) : (
                                  <AlertCircle className="h-3 w-3 text-red-500" />
                                )}
                              </div>
                            </div>
                          ))}
                          {previewData.length > 10 && (
                            <div className="text-center text-xs text-muted-foreground pt-2 border-t">
                              En {previewData.length - 10} meer...
                            </div>
                          )}
                        </div>
                      </ScrollArea>

                      {/* Summary */}
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            E-mails: {previewData.filter(p => p.detected_type === 'email').length}
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                            Domeinen: {previewData.filter(p => p.detected_type === 'domain').length}
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            Bedrijven: {previewData.filter(p => p.detected_type === 'company').length}
                          </div>
                        </div>
                      </div>

                      {/* Warnings */}
                      {previewData.some(p => p.warning) && (
                        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                          <div className="flex items-center gap-2 text-sm text-yellow-800">
                            <AlertCircle className="h-4 w-4" />
                            <span className="font-medium">Let op:</span>
                          </div>
                          <div className="text-xs text-yellow-700 mt-1">
                            {previewData.filter(p => p.warning).length} entries hebben waarschuwingen
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              )}

              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={loading}
                >
                  Annuleren
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!selectedFile || loading}
                >
                  {loading ? "Importeren..." : "Importeren"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}