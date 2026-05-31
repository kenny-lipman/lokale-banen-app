"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import Link from "next/link"
import {
  Home,
  Building2,
  Users,
  Briefcase,
  MapPin,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Bot,
  Shield,
  ArrowLeftRight,
  Mail,
  Monitor,
  Workflow,
  type LucideIcon,
} from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { cn } from "@/lib/utils"
import { prefetchRoute } from "@/lib/swr-prefetch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type NavLeaf = {
  href: string
  icon: LucideIcon
  label: string
}

type NavItem = NavLeaf & {
  children?: NavLeaf[]
  adminOnly?: boolean
}

type NavSection = {
  label?: string
  items: NavItem[]
}

const sections: NavSection[] = [
  {
    items: [
      { href: "/", icon: Home, label: "OTIS" },
      { href: "/agents/otis/enhanced", icon: Bot, label: "Otis" },
    ],
  },
  {
    label: "Werk",
    items: [
      {
        href: "/job-postings",
        icon: Briefcase,
        label: "Vacatures",
        children: [
          { href: "/job-postings", icon: Briefcase, label: "Overzicht" },
          { href: "/job-postings/scrape-bronnen", icon: Monitor, label: "Scrape-bronnen" },
        ],
      },
      { href: "/companies", icon: Building2, label: "Bedrijven" },
      { href: "/contacten", icon: Users, label: "Contacten" },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/sales/lead-verrijking", icon: Mail, label: "Lead Verrijking" },
      { href: "/sales/owner-mapping", icon: Settings, label: "Owner Mapping" },
      { href: "/campaign-assignment", icon: Mail, label: "Campaign Assignment" },
      { href: "/blocklist", icon: Shield, label: "Blocklist" },
      { href: "/instantly-sync", icon: ArrowLeftRight, label: "Instantly <> PD Sync" },
      { href: "/mailerlite-sync", icon: Mail, label: "MailerLite Sync" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/platforms", icon: Monitor, label: "Platforms" },
      { href: "/regios", icon: MapPin, label: "Regio's" },
      { href: "/automatiseringen", icon: Workflow, label: "Automatiseringen" },
    ],
  },
  {
    label: "Beheer",
    items: [
      { href: "/admin/gebruikers", icon: Users, label: "Gebruikers", adminOnly: true },
      { href: "/settings", icon: Settings, label: "Instellingen" },
    ],
  },
]

const COOKIE_KEY = "sidebar:collapsed"

function readCollapsedCookie(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie.split("; ").some((c) => c === `${COOKIE_KEY}=1`)
}

function writeCollapsedCookie(value: boolean) {
  document.cookie = `${COOKIE_KEY}=${value ? 1 : 0}; path=/; max-age=31536000; samesite=lax`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({})
  const pathname = usePathname()
  const router = useRouter()
  const { logout, isAdmin, user } = useAuth()

  // Collapse-state uit cookie herstellen na hydration (voorkomt SSR-mismatch).
  useEffect(() => {
    setCollapsed(readCollapsedCookie())
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      writeCollapsedCookie(next)
      return next
    })
  }

  // Cmd/Ctrl+B toggelt de sidebar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault()
        toggleCollapsed()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Bepaal de actieve href: exact-match of langste prefix-match over alle leaves.
  const activeHref = useMemo(() => {
    const leaves: string[] = []
    for (const section of sections) {
      for (const item of section.items) {
        if (item.children) item.children.forEach((c) => leaves.push(c.href))
        else leaves.push(item.href)
      }
    }
    let best: string | null = null
    for (const href of leaves) {
      const match = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")
      if (match && (best === null || href.length > best.length)) best = href
    }
    return best
  }, [pathname])

  // Groepen met een actief kind staan standaard open.
  useEffect(() => {
    setOpenMenus((prev) => {
      const next = { ...prev }
      for (const section of sections) {
        for (const item of section.items) {
          if (item.children?.some((c) => c.href === activeHref)) next[item.label] = true
        }
      }
      return next
    })
  }, [activeHref])

  const toggleMenu = (label: string) =>
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }))

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) || user?.email || "Gebruiker"
  const roleLabel = isAdmin ? "Admin" : "Member"

  const rowBase =
    "group relative flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-colors"

  // Een enkele leaf-link renderen (top-level item zonder children, of submenu-kind).
  const renderLink = (item: NavLeaf, opts?: { sub?: boolean }) => {
    const active = item.href === activeHref
    const link = (
      <Link
        key={item.href}
        href={item.href}
        onMouseEnter={() => prefetchRoute(item.href)}
        className={cn(
          rowBase,
          collapsed ? "mx-2 justify-center px-0 py-2" : "mx-2 px-2.5 py-1.5",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          opts?.sub && !collapsed && "py-1",
        )}
      >
        {active && !collapsed && (
          <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-orange-500" />
        )}
        <item.icon
          className={cn(
            "shrink-0",
            opts?.sub ? "h-4 w-4" : "h-[18px] w-[18px]",
            active ? "text-orange-500" : "text-current",
          )}
        />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    )

    if (!collapsed) return link
    return (
      <Tooltip key={item.href} delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    )
  }

  // Een groep (item met children) renderen.
  const renderGroup = (item: NavItem) => {
    const isOpen = openMenus[item.label] || false
    const groupActive = item.children!.some((c) => c.href === activeHref)

    // Ingeklapt: groep gedraagt zich als een enkele link naar de parent-href.
    if (collapsed) {
      return renderLink({ href: item.href, icon: item.icon, label: item.label })
    }

    return (
      <div key={item.label}>
        <button
          type="button"
          onClick={() => toggleMenu(item.label)}
          aria-expanded={isOpen}
          className={cn(
            rowBase,
            "mx-2 w-[calc(100%-1rem)] px-2.5 py-1.5",
            groupActive
              ? "text-sidebar-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          )}
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" />
          <span className="flex-1 truncate text-left">{item.label}</span>
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/50" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/50" />
          )}
        </button>
        {isOpen && (
          <div className="mt-0.5 ml-[1.85rem] flex flex-col gap-0.5 border-l border-sidebar-border pl-1.5">
            {item.children!.map((sub) => renderLink(sub, { sub: true }))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-[60px]" : "w-60",
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center gap-2 px-3">
        {!collapsed && (
          <Link href="/" className="flex min-w-0 items-center px-1.5">
            <Logo size="sm" className="text-sidebar-foreground" />
          </Link>
        )}
        <button
          onClick={toggleCollapsed}
          className={cn(
            "ml-auto flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "mx-auto",
          )}
          aria-label={collapsed ? "Sidebar uitklappen (Cmd+B)" : "Sidebar inklappen (Cmd+B)"}
          title={collapsed ? "Uitklappen (Cmd+B)" : "Inklappen (Cmd+B)"}
        >
          {collapsed ? <PanelLeft className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
        </button>
      </div>

      {/* Navigatie */}
      <nav className="flex-1 overflow-y-auto py-2">
        {sections.map((section, idx) => {
          const items = section.items.filter((item) => !item.adminOnly || isAdmin)
          if (items.length === 0) return null
          return (
            <div key={section.label ?? `section-${idx}`} className={cn(idx > 0 && "mt-4")}>
              {section.label && !collapsed && (
                <p className="px-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {section.label}
                </p>
              )}
              {section.label && collapsed && idx > 0 && (
                <div className="mx-3 mb-2 border-t border-sidebar-border" />
              )}
              <div className="flex flex-col gap-0.5">
                {items.map((item) =>
                  item.children ? renderGroup(item) : renderLink(item),
                )}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User-blok */}
      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-sidebar-accent",
                collapsed && "justify-center",
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[11px] font-semibold text-white">
                {initials(displayName)}
              </span>
              {!collapsed && (
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-medium text-sidebar-foreground">
                    {displayName}
                  </span>
                  <span className="truncate text-[11px] text-sidebar-foreground/50">{roleLabel}</span>
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <span className="flex flex-col">
                <span className="truncate text-sm font-medium">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Instellingen
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-red-600 focus:text-red-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Uitloggen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
