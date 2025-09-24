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
import { FileUpload } from "./file-upload"
import { CheckCircle } from "lucide-react"

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

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    setError(null)
    setSuccess(false)
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