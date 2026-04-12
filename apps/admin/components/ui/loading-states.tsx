import { Loader2, RefreshCw } from "lucide-react"

interface PageLoadingOverlayProps {
  message?: string
  className?: string
  showRefreshButton?: boolean
  onRefresh?: () => void
}

export function PageLoadingOverlay({ 
  message = "Laden...", 
  className = "",
  showRefreshButton = false,
  onRefresh
}: PageLoadingOverlayProps) {
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm ${className}`}>
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <div className="absolute inset-0 rounded-full border-2 border-blue-200"></div>
        </div>
        <p className="text-sm font-medium text-gray-600 animate-pulse">
          {message}
        </p>
        {showRefreshButton && onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center space-x-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Opnieuw proberen</span>
          </button>
        )}
      </div>
    </div>
  )
}

interface SkeletonProps {
  className?: string
  lines?: number
}

export function Skeleton({ className = "", lines = 1 }: SkeletonProps) {
  return (
    <div className={`animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-200 rounded mb-2 last:mb-0"
          style={{ width: `${Math.random() * 40 + 60}%` }}
        />
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="animate-pulse">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="p-4">
              <div className="h-4 bg-gray-200 rounded" style={{ width: `${Math.random() * 40 + 60}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// List skeleton for dashboard items
export function ListSkeleton({ items = 6 }: { items?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Dashboard stats skeleton
export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="bg-white rounded-lg border p-6 animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="h-4 bg-gray-200 rounded w-20" />
            <div className="h-4 w-4 bg-gray-200 rounded" />
          </div>
          <div className="h-8 bg-gray-200 rounded w-24 mb-2" />
          <div className="h-3 bg-gray-200 rounded w-16" />
        </div>
      ))}
    </div>
  )
}

// Loading spinner component
export function LoadingSpinner({ 
  size = "md",
  className = "" 
}: { 
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6", 
    lg: "w-8 h-8"
  }

  return (
    <div className={`${sizeClasses[size]} border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin ${className}`} />
  )
} 