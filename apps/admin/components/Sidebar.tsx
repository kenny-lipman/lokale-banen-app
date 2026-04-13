"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Bot,
  Shield,
  ArrowLeftRight,
  Mail,
  ClipboardCheck,
  Monitor,
  Plus,
} from "lucide-react"
import { Logo } from "@/components/ui/logo"

const menu = [
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  {
    label: "Agents",
    icon: Users,
    children: [
      { href: "/agents/otis/enhanced", icon: Bot, label: "Otis" },
    ],
    href: "/agents"
  },
  { href: "/review", icon: ClipboardCheck, label: "Review" },
  {
    label: "Vacatures",
    icon: Briefcase,
    href: "/job-postings",
    children: [
      { href: "/job-postings", icon: Briefcase, label: "Overzicht" },
      { href: "/vacatures/nieuw", icon: Plus, label: "Nieuw aanmaken" },
    ],
  },
  {
    label: "Bedrijven",
    icon: Building2,
    href: "/companies",
    children: [
      { href: "/companies", icon: Building2, label: "Overzicht" },
      { href: "/bedrijven/nieuw", icon: Plus, label: "Nieuw aanmaken" },
    ],
  },
  { href: "/contacten", icon: Users, label: "Contacten" },
  { href: "/blocklist", icon: Shield, label: "Blocklist" },
  { href: "/instantly-sync", icon: ArrowLeftRight, label: "Instantly <> PD Sync" },
  { href: "/campaign-assignment", icon: Mail, label: "Campaign Assignment" },
  { href: "/mailerlite-sync", icon: Mail, label: "MailerLite Sync" },
  { href: "/platforms", icon: Monitor, label: "Platforms" },
  { href: "/regios", icon: MapPin, label: "Regio's" },
  { href: "/settings", icon: Settings, label: "Instellingen" },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({})
  const router = useRouter()
  const { logout } = useAuth()

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  // Zorg dat Agents standaard open is als je op Agents of een submenu zit
  // (optioneel: kun je uitbreiden met router.pathname check)

  return (
    <aside
      className={`h-screen bg-white border-r border-gray-200 flex flex-col transition-all duration-200 ${collapsed ? "w-16" : "w-64"}`}
    >
      {/* Header met logo en expand/collapse knop */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 min-h-[56px]">
        <div className={`flex items-center transition-all duration-200 ${collapsed ? "opacity-0 w-0" : "opacity-100 w-auto"}`}>
          <Logo size="md" className="text-gray-900" />
        </div>
        {collapsed && (
          <div className="absolute left-1/2 top-4 transform -translate-x-1/2">
            <Logo size="sm" className="text-gray-900" />
          </div>
        )}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center justify-center w-10 h-10 rounded hover:bg-orange-100 transition z-10"
          aria-label={collapsed ? "Sidebar uitklappen" : "Sidebar inklappen"}
        >
          {collapsed ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
        </button>
      </div>
      {/* Menu */}
      <nav className="flex-1 flex flex-col gap-1 mt-2">
        {menu.map((item) => {
          if (item.children) {
            const isOpen = openMenus[item.label] || false
            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => toggleMenu(item.label)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg mx-2 my-1 text-gray-800 hover:bg-orange-50 transition-all text-lg font-medium w-full ${collapsed ? "justify-center px-2" : ""}`}
                  aria-expanded={isOpen}
                >
                  <item.icon className="w-6 h-6 scale-90" />
                  {!collapsed && <span className="truncate text-base flex-1 text-left">{item.label}</span>}
                  {!collapsed && (
                    isOpen ? <ChevronDown className="w-5 h-5 ml-auto" /> : <ChevronRight className="w-5 h-5 ml-auto" />
                  )}
                </button>
                {!collapsed && isOpen && (
                  <div className="ml-8 border-l border-orange-100 pl-2">
                    {item.children.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className="flex items-center gap-2 px-2 py-2 rounded-lg my-1 text-gray-700 hover:bg-orange-50 transition-all text-base font-normal"
                      >
                        <sub.icon className="w-5 h-5 text-orange-500" />
                        <span className="truncate">{sub.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mx-2 my-1 text-gray-800 hover:bg-orange-50 transition-all text-lg font-medium ${collapsed ? "justify-center px-2" : ""}`}
            >
              <item.icon className="w-6 h-6" />
              {!collapsed && <span className="truncate text-base">{item.label}</span>}
            </Link>
          )
        })}
      </nav>
      {/* Bottom actions - Uitloggen knop */}
      <div className="mt-auto flex flex-col gap-2 pb-4">
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg mx-2 text-red-600 hover:bg-red-50 hover:text-red-700 transition-all text-lg font-medium ${collapsed ? "justify-center px-2" : ""}`}
        >
          <LogOut className="w-6 h-6" />
          {!collapsed && <span className="truncate text-base">Uitloggen</span>}
        </button>
      </div>
    </aside>
  )
} 