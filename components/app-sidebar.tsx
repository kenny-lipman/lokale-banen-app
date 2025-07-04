"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Bot,
  Building2,
  LayoutDashboard,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Agents",
    icon: Bot,
    items: [
      {
        name: "Otis",
        href: "/agents",
        description: "Job vacancy scraping agent",
      },
    ],
  },
  {
    name: "Job Postings",
    href: "/job-postings",
    icon: BarChart3,
  },
  {
    name: "Companies",
    href: "/companies",
    icon: Building2,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { state, toggleSidebar, isMobile, openMobile } = useSidebar()

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && openMobile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" onClick={toggleSidebar} />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "bg-gray-100 border-r border-gray-200 transition-all duration-300 flex flex-col",
          // Desktop behavior
          "hidden md:flex",
          state === "expanded" ? "w-64" : "w-16",
          // Mobile behavior
          isMobile && openMobile && "fixed inset-y-0 left-0 z-50 flex w-64 md:hidden",
        )}
      >
        {/* Header */}
        <div className={cn("border-b border-gray-200", state === "expanded" ? "p-6" : "p-3")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">LB</span>
              </div>
              {(state === "expanded" || isMobile) && (
                <span className="font-bold text-lg text-gray-900">LokaleBanen</span>
              )}
            </div>
            {/* Toggle button - always visible on desktop, hidden on mobile */}
            {!isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className="h-8 w-8 p-0 hover:bg-gray-200 shrink-0"
              >
                {state === "expanded" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="sr-only">Toggle Sidebar</span>
              </Button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="px-3 space-y-1">
            {navigation.map((item) => {
              if (item.items) {
                // Dropdown menu item (Agents)
                const isActive = pathname.startsWith("/agents")

                return (
                  <Collapsible key={item.name} defaultOpen={isActive} className="group/collapsible">
                    <div>
                      <CollapsibleTrigger asChild>
                        <button
                          className={cn(
                            "flex items-center w-full px-3 py-2 rounded-md text-sm font-medium transition-colors group",
                            isActive
                              ? "bg-orange-100 text-orange-600"
                              : "text-gray-600 hover:text-gray-900 hover:bg-gray-200",
                            state === "collapsed" && !isMobile && "justify-center",
                          )}
                        >
                          <item.icon className="w-5 h-5 shrink-0" />
                          {(state === "expanded" || isMobile) && (
                            <>
                              <span className="ml-3">{item.name}</span>
                              <ChevronDown className="ml-auto w-4 h-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                            </>
                          )}
                        </button>
                      </CollapsibleTrigger>
                      {(state === "expanded" || isMobile) && (
                        <CollapsibleContent>
                          <div className="ml-6 mt-1 space-y-1">
                            {item.items.map((subItem) => {
                              const isSubActive = pathname === subItem.href
                              return (
                                <Link
                                  key={subItem.name}
                                  href={subItem.href}
                                  className={cn(
                                    "flex items-center px-3 py-2 rounded-md text-sm transition-colors",
                                    isSubActive
                                      ? "bg-orange-100 text-orange-600 font-semibold"
                                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-200",
                                  )}
                                >
                                  <Bot className="w-4 h-4 mr-3" />
                                  <span>{subItem.name}</span>
                                </Link>
                              )
                            })}
                          </div>
                        </CollapsibleContent>
                      )}
                    </div>
                  </Collapsible>
                )
              } else {
                // Regular menu item
                const isActive = pathname === item.href

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors group",
                      isActive
                        ? "bg-orange-100 text-orange-500 font-semibold"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-200",
                      state === "collapsed" && !isMobile && "justify-center",
                    )}
                    title={state === "collapsed" && !isMobile ? item.name : undefined}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    {(state === "expanded" || isMobile) && <span className="ml-3">{item.name}</span>}
                  </Link>
                )
              }
            })}
          </nav>
        </div>
      </div>
    </>
  )
}
