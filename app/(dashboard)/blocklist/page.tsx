"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { BlocklistTable } from "@/components/blocklist/blocklist-table"
import { BlocklistModal } from "@/components/blocklist/blocklist-modal"
import { BlocklistStats } from "@/components/blocklist/blocklist-stats"
import { BlocklistBulkActions } from "@/components/blocklist/blocklist-bulk-actions"
import { InstantlySyncPanel } from "@/components/blocklist/instantly-sync-panel"
import { useBlocklist, type BlocklistEntry } from "@/hooks/use-blocklist"
import {
  Plus,
  Search,
  Filter,
  Shield,
  RefreshCw,
  Download,
  Upload,
  X,
} from "lucide-react"
import { TablePagination } from "@/components/ui/table-filters"

export default function BlocklistPage() {
  const {
    entries,
    stats,
    pagination,
    filters,
    loading,
    error,
    createEntry,
    updateEntry,
    deleteEntry,
    bulkActivate,
    bulkDeactivate,
    bulkDelete,
    importEntries,
    exportEntries,
    syncToInstantly,
    changePage,
    changeLimit,
    updateFilters,
    refetch,
  } = useBlocklist()

  // UI State
  const [selectedEntries, setSelectedEntries] = useState<string[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<BlocklistEntry | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingEntry, setDeletingEntry] = useState<BlocklistEntry | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Handlers
  const handleAddEntry = async (data: any) => {
    await createEntry(data)
    setShowAddModal(false)
  }

  const handleEditEntry = (entry: BlocklistEntry) => {
    setEditingEntry(entry)
    setShowEditModal(true)
  }

  const handleUpdateEntry = async (data: any) => {
    if (editingEntry) {
      await updateEntry(editingEntry.id, data)
      setShowEditModal(false)
      setEditingEntry(null)
    }
  }

  const handleDeleteEntry = (entry: BlocklistEntry) => {
    setDeletingEntry(entry)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (deletingEntry) {
      await deleteEntry(deletingEntry.id)
      setShowDeleteDialog(false)
      setDeletingEntry(null)
    }
  }

  const handleToggleActive = async (entry: BlocklistEntry) => {
    await updateEntry(entry.id, { is_active: !entry.is_active })
  }

  const handleBulkImport = async (file: File) => {
    await importEntries(file)
  }

  const handleExport = async () => {
    await exportEntries("csv")
  }

  const handleSyncAll = async () => {
    return await syncToInstantly()
  }

  const clearFilters = () => {
    updateFilters({
      search: "",
      type: undefined,
      is_active: undefined,
    })
  }

  const hasActiveFilters = filters.search || filters.type || filters.is_active !== undefined

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Blocklist Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Beheer geblokkeerde e-mailadressen en domeinen voor jouw campaigns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refetch} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Vernieuwen
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Entry Toevoegen
          </Button>
        </div>
      </div>

      {/* Stats */}
      <BlocklistStats stats={stats} loading={loading} />

      {/* Main Content */}
      <Tabs defaultValue="entries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entries">Blocklist Entries</TabsTrigger>
          <TabsTrigger value="sync">Sync Status</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <CardTitle className="text-lg">Filters</CardTitle>
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2">
                      Actief
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-muted-foreground"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Wissen
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    {showFilters ? "Verbergen" : "Tonen"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {showFilters && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Zoeken</label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Zoek in waarde of reden..."
                        value={filters.search || ""}
                        onChange={(e) =>
                          updateFilters({ search: e.target.value })
                        }
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type</label>
                    <Select
                      value={filters.type || "all"}
                      onValueChange={(value) =>
                        updateFilters({
                          type: value === "all" ? undefined : (value as "email" | "domain"),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle types</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="domain">Domein</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select
                      value={
                        filters.is_active === undefined
                          ? "all"
                          : filters.is_active
                          ? "active"
                          : "inactive"
                      }
                      onValueChange={(value) =>
                        updateFilters({
                          is_active:
                            value === "all"
                              ? undefined
                              : value === "active",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle statussen</SelectItem>
                        <SelectItem value="active">Actief</SelectItem>
                        <SelectItem value="inactive">Inactief</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Bulk Actions */}
          <BlocklistBulkActions
            selectedItems={selectedEntries}
            onClearSelection={() => setSelectedEntries([])}
            onBulkActivate={bulkActivate}
            onBulkDeactivate={bulkDeactivate}
            onBulkDelete={bulkDelete}
            onBulkImport={handleBulkImport}
            onExport={handleExport}
            onSyncAll={handleSyncAll}
            loading={loading}
          />

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <BlocklistTable
                entries={entries}
                loading={loading}
                onEdit={handleEditEntry}
                onDelete={handleDeleteEntry}
                onToggleActive={handleToggleActive}
                selectedEntries={selectedEntries}
                onSelectionChange={setSelectedEntries}
              />
            </CardContent>
          </Card>

          {/* Pagination */}
          <TablePagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalCount={pagination.total}
            itemsPerPage={pagination.limit}
            onPageChange={changePage}
            onItemsPerPageChange={changeLimit}
          />
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <InstantlySyncPanel
            onSync={handleSyncAll}
            loading={loading}
            stats={stats}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <BlocklistModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        mode="add"
        onSubmit={handleAddEntry}
        loading={loading}
      />

      <BlocklistModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        mode="edit"
        initialData={editingEntry || undefined}
        onSubmit={handleUpdateEntry}
        loading={loading}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Entry Verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze blocklist entry wilt verwijderen? Deze actie
              kan niet ongedaan worden gemaakt.
              {deletingEntry && (
                <div className="mt-2 p-2 bg-gray-50 rounded">
                  <strong>{deletingEntry.value}</strong> ({deletingEntry.type})
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}