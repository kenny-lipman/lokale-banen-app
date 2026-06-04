'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import { Loader2, MoreVertical, Plus, RefreshCcw, Settings, Copy, RefreshCw } from 'lucide-react'

type AdminUser = {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'member'
  created_at: string | null
  last_sign_in_at: string | null
  banned: boolean
}

type Props = { currentUserId: string }

const dateShort = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const lastLoginRel = (iso: string | null) => {
  if (!iso) return 'Nog nooit'
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins} min geleden`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} uur geleden`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} dag${days === 1 ? '' : 'en'} geleden`
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 14; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export function GebruikersClient({ currentUserId }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modal state
  const [createOpen, setCreateOpen] = useState(false)
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null)
  const [disableTarget, setDisableTarget] = useState<AdminUser | null>(null)
  const [enableTarget, setEnableTarget] = useState<AdminUser | null>(null)
  const [logoutTarget, setLogoutTarget] = useState<AdminUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' })
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`)
      const json = (await res.json()) as { users: AdminUser[] }
      setUsers(json.users)
    } catch (e) {
      toast.error('Laden mislukt', { description: (e as Error).message })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const adminCount = users.filter((u) => u.role === 'admin').length
  const memberCount = users.filter((u) => u.role === 'member').length
  const disabledCount = users.filter((u) => u.banned).length

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Gebruikers</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={refreshing}>
            <RefreshCcw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Vernieuwen
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1" />
            Nieuwe gebruiker
          </Button>
        </div>
      </div>
      <p className="text-gray-500 text-sm mb-6">
        Beheer accounts, rollen en sessies. Soft-delete via &quot;Disable&quot;; hard-delete via &quot;Verwijderen&quot;.
      </p>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="size-5 text-orange-600" />
            <CardTitle>Accounts ({users.length})</CardTitle>
            <span className="text-xs text-gray-500 ml-auto">
              {adminCount} admin{adminCount === 1 ? '' : 's'} · {memberCount} member{memberCount === 1 ? '' : 's'} · {disabledCount} disabled
            </span>
          </div>
          <CardDescription>Klik op ⋮ voor acties per rij.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-gray-500 py-8 text-center">
              <Loader2 className="size-5 animate-spin mx-auto mb-2" />
              Laden...
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-500 border-b">
                <tr>
                  <th className="text-left py-2 font-medium">E-mail</th>
                  <th className="text-left py-2 font-medium">Naam</th>
                  <th className="text-left py-2 font-medium">Rol</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-left py-2 font-medium">Aangemaakt op</th>
                  <th className="text-left py-2 font-medium">Laatste login</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === currentUserId
                  return (
                    <tr key={u.id} className={`border-b hover:bg-gray-50/50 ${u.banned ? 'opacity-60' : ''}`}>
                      <td className="py-3 font-medium">
                        {u.email}
                        {isSelf && <span className="text-xs text-gray-400 ml-2">(jij)</span>}
                      </td>
                      <td className="py-3 text-gray-700">{u.full_name ?? '—'}</td>
                      <td className="py-3">
                        {u.role === 'admin' ? (
                          <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Admin</Badge>
                        ) : (
                          <Badge variant="secondary">Member</Badge>
                        )}
                      </td>
                      <td className="py-3">
                        {u.banned ? (
                          <Badge variant="secondary" className="gap-1">
                            <span className="size-1.5 rounded-full bg-gray-500" />
                            Disabled
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1">
                            <span className="size-1.5 rounded-full bg-green-500" />
                            Actief
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 text-gray-500 text-xs">{dateShort(u.created_at)}</td>
                      <td className="py-3 text-gray-500 text-xs">{lastLoginRel(u.last_sign_in_at)}</td>
                      <td className="py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="size-8 p-0">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem disabled={isSelf} onClick={() => setRoleTarget(u)}>
                              Rol wijzigen
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={isSelf || u.banned} onClick={() => setLogoutTarget(u)}>
                              Force logout
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {u.banned ? (
                              <DropdownMenuItem onClick={() => setEnableTarget(u)}>
                                Heractiveren
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                disabled={isSelf}
                                onClick={() => setDisableTarget(u)}
                                className="text-amber-700"
                              >
                                Disable (soft-delete)
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={isSelf}
                              onClick={() => setDeleteTarget(u)}
                              className="text-red-700"
                            >
                              Verwijderen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-gray-500">
                      Geen gebruikers gevonden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <CreateUserModal open={createOpen} onOpenChange={setCreateOpen} onCreated={() => void load()} />
      {roleTarget && (
        <RoleModal user={roleTarget} onOpenChange={(o) => !o && setRoleTarget(null)} onSaved={() => void load()} />
      )}
      {disableTarget && (
        <ConfirmModal
          user={disableTarget}
          onOpenChange={(o) => !o && setDisableTarget(null)}
          onConfirmed={() => void load()}
          title="Account disablen?"
          description="Het account wordt geblokkeerd en alle sessies worden beëindigd. Bestaande data blijft staan. Re-activeren kan op elk moment."
          confirmLabel="Account disablen"
          confirmVariant="amber"
          endpoint={(id) => `/api/admin/users/${id}/disable`}
        />
      )}
      {enableTarget && (
        <ConfirmModal
          user={enableTarget}
          onOpenChange={(o) => !o && setEnableTarget(null)}
          onConfirmed={() => void load()}
          title="Account heractiveren?"
          description="Het account wordt direct weer actief. De user kan opnieuw inloggen."
          confirmLabel="Heractiveren"
          confirmVariant="default"
          endpoint={(id) => `/api/admin/users/${id}/enable`}
        />
      )}
      {logoutTarget && (
        <ConfirmModal
          user={logoutTarget}
          onOpenChange={(o) => !o && setLogoutTarget(null)}
          onConfirmed={() => void load()}
          title="Geforceerd uitloggen?"
          description={`Alle actieve sessies van ${logoutTarget.email} worden direct beëindigd.`}
          confirmLabel="Uitloggen"
          confirmVariant="default"
          endpoint={(id) => `/api/admin/users/${id}/force-logout`}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          user={deleteTarget}
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          onDeleted={() => void load()}
        />
      )}
    </div>
  )
}

// ============ Create user modal ============

function CreateUserModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: () => void
}) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState(generatePassword())
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setEmail('')
      setFullName('')
      setPassword(generatePassword())
      setRole('member')
    }
  }, [open])

  const submit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName || null, role }),
      })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      toast.success('Account aangemaakt', { description: `${email} is toegevoegd.` })
      onCreated()
      onOpenChange(false)
    } catch (e) {
      toast.error('Aanmaken mislukt', { description: (e as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  const copyPassword = async () => {
    await navigator.clipboard.writeText(password)
    toast.success('Wachtwoord gekopieerd')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nieuwe gebruiker</DialogTitle>
          <DialogDescription>
            Account wordt direct aangemaakt. Geef het wachtwoord handmatig door — de user kan het later via &quot;Wachtwoord vergeten&quot; op /login wijzigen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm">E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="naam@bedrijf.nl"
            />
          </div>
          <div>
            <Label className="text-sm">
              Volledige naam <span className="text-gray-400 font-normal">(optioneel)</span>
            </Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jan Jansen" />
          </div>
          <div>
            <Label className="text-sm">Tijdelijk wachtwoord</Label>
            <div className="flex gap-2">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono" />
              <Button type="button" variant="outline" size="sm" onClick={() => setPassword(generatePassword())} title="Genereer nieuw wachtwoord">
                <RefreshCw className="size-4" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={copyPassword} title="Kopieer">
                <Copy className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">Minimaal 8 tekens.</p>
          </div>
          <div>
            <Label className="text-sm mb-2 block">Rol</Label>
            <RadioGroup value={role} onValueChange={(v) => setRole(v as 'admin' | 'member')} className="flex gap-2">
              <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer flex-1 has-[:checked]:border-orange-300 has-[:checked]:bg-orange-50">
                <RadioGroupItem value="member" />
                <span className="font-medium text-sm">Member</span>
                <span className="text-xs text-gray-500 ml-auto">basis</span>
              </label>
              <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer flex-1 has-[:checked]:border-orange-300 has-[:checked]:bg-orange-50">
                <RadioGroupItem value="admin" />
                <span className="font-medium text-sm">Admin</span>
                <span className="text-xs text-gray-500 ml-auto">volledig</span>
              </label>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={submit} disabled={submitting || !email || password.length < 8}>
            {submitting ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            Account aanmaken
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Role change modal ============

function RoleModal({
  user,
  onOpenChange,
  onSaved,
}: {
  user: AdminUser
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const [role, setRole] = useState<'admin' | 'member'>(user.role)
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`)
      toast.success('Rol gewijzigd', { description: `${user.email} is nu ${role}.` })
      onSaved()
      onOpenChange(false)
    } catch (e) {
      toast.error('Wijzigen mislukt', { description: (e as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rol wijzigen</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <RadioGroup value={role} onValueChange={(v) => setRole(v as 'admin' | 'member')} className="flex gap-2">
          <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer flex-1 has-[:checked]:border-orange-300 has-[:checked]:bg-orange-50">
            <RadioGroupItem value="admin" />
            <span className="font-medium text-sm">Admin</span>
          </label>
          <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer flex-1 has-[:checked]:border-orange-300 has-[:checked]:bg-orange-50">
            <RadioGroupItem value="member" />
            <span className="font-medium text-sm">Member</span>
          </label>
        </RadioGroup>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={submit} disabled={submitting || role === user.role}>
            {submitting ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Generieke confirm modal ============

function ConfirmModal({
  user,
  onOpenChange,
  onConfirmed,
  title,
  description,
  confirmLabel,
  confirmVariant,
  endpoint,
}: {
  user: AdminUser
  onOpenChange: (o: boolean) => void
  onConfirmed: () => void
  title: string
  description: string
  confirmLabel: string
  confirmVariant: 'default' | 'amber'
  endpoint: (id: string) => string
}) {
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(endpoint(user.id), { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`)
      toast.success('Gelukt', { description: confirmLabel })
      onConfirmed()
      onOpenChange(false)
    } catch (e) {
      toast.error('Mislukt', { description: (e as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-gray-600">{description}</p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button
            onClick={submit}
            disabled={submitting}
            className={confirmVariant === 'amber' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
          >
            {submitting ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ Delete (danger zone) modal ============

function DeleteModal({
  user,
  onOpenChange,
  onDeleted,
}: {
  user: AdminUser
  onOpenChange: (o: boolean) => void
  onDeleted: () => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canDelete = confirmText.trim().toLowerCase() === user.email.toLowerCase()

  const submit = async () => {
    if (!canDelete) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`)
      toast.success('Account verwijderd', { description: user.email })
      onDeleted()
      onOpenChange(false)
    } catch (e) {
      toast.error('Verwijderen mislukt', { description: (e as Error).message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-red-200">
        <DialogHeader>
          <DialogTitle className="text-red-700">Account permanent verwijderen?</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-900">
          Deze actie kan <strong>niet</strong> ongedaan gemaakt worden. Alle sessies worden beëindigd, het auth-record wordt verwijderd. Overweeg eerst &quot;Disable&quot;.
        </div>
        <div>
          <Label className="text-sm">Typ ter bevestiging het e-mailadres:</Label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={user.email}
            className="font-mono"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button
            onClick={submit}
            disabled={!canDelete || submitting}
            className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          >
            {submitting ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            Verwijderen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
