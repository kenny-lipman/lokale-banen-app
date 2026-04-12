"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import {
  ChevronDown,
  Power,
  PowerOff,
  Trash,
  Download,
  Upload,
  RefreshCw,
  X,
} from "lucide-react"
import { ImportModal } from "./import-modal"

interface BlocklistBulkActionsProps {
  selectedItems: string[]
  onClearSelection: () => void
  onBulkActivate: (ids: string[]) => Promise<void>
  onBulkDeactivate: (ids: string[]) => Promise<void>
  onBulkDelete: (ids: string[]) => Promise<void>
  onBulkImport: (file: File) => Promise<void>
  onExport: () => Promise<void>
  onSyncAll: () => Promise<void>
  loading?: boolean
}

export function BlocklistBulkActions({
  selectedItems,
  onClearSelection,
  onBulkActivate,
  onBulkDeactivate,
  onBulkDelete,
  onBulkImport,
  onExport,
  onSyncAll,
  loading = false,
}: BlocklistBulkActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [action, setAction] = useState<"activate" | "deactivate" | "delete" | null>(null)

  const handleBulkAction = async (actionType: "activate" | "deactivate" | "delete") => {
    try {
      switch (actionType) {
        case "activate":
          await onBulkActivate(selectedItems)
          break
        case "deactivate":
          await onBulkDeactivate(selectedItems)
          break
        case "delete":
          await onBulkDelete(selectedItems)
          break
      }
      onClearSelection()
    } catch (error) {
      console.error("Bulk action failed:", error)
    }
  }

  const handleImport = async (file: File) => {
    await onBulkImport(file)
    setShowImportModal(false)
  }

  const confirmDelete = () => {
    setAction("delete")
    setShowDeleteDialog(true)
  }

  const executeAction = async () => {
    if (action) {
      await handleBulkAction(action)
      setShowDeleteDialog(false)
      setAction(null)
    }
  }

  if (selectedItems.length === 0) {
    return (
      <>
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Geen items geselecteerd
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onExport} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              Exporteren
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportModal(true)}
              disabled={loading}
            >
              <Upload className="h-4 w-4 mr-2" />
              Importeren
            </Button>
            <Button variant="outline" size="sm" onClick={onSyncAll} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Alles Synchroniseren
            </Button>
          </div>
        </div>

        <ImportModal
          open={showImportModal}
          onOpenChange={setShowImportModal}
          onImport={handleImport}
          loading={loading}
        />
      </>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between p-4 bg-blue-50 border-l-4 border-blue-400 rounded-lg">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="px-2 py-1">
            {selectedItems.length} geselecteerd
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-6 w-6 p-0 hover:bg-blue-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={loading}>
                Acties
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleBulkAction("activate")}>
                <Power className="mr-2 h-4 w-4 text-green-600" />
                Activeren
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkAction("deactivate")}>
                <PowerOff className="mr-2 h-4 w-4 text-orange-600" />
                Deactiveren
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={confirmDelete}
                className="text-red-600 focus:text-red-600"
              >
                <Trash className="mr-2 h-4 w-4" />
                Verwijderen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={onExport} disabled={loading}>
            <Download className="h-4 w-4 mr-2" />
            Exporteren
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Items Verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {selectedItems.length} geselecteerde items wilt verwijderen?
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeAction}
              className="bg-red-600 hover:bg-red-700"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImport={handleImport}
        loading={loading}
      />
    </>
  )
}