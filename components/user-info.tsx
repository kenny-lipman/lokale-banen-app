"use client"

import { useAuth } from "@/components/auth-provider"

function getInitials(name: string | null | undefined, email: string | null | undefined) {
  if (name && name.trim() !== "") {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  }
  if (email) return email[0].toUpperCase()
  return "?"
}

export function UserInfo() {
  const { profile, user } = useAuth()
  const displayName = profile?.full_name || user?.email || "Gebruiker"
  const initials = getInitials(profile?.full_name, user?.email)

  return (
    <div className="flex items-center gap-3 px-2 py-1 rounded hover:bg-gray-100 cursor-pointer select-none">
      <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-lg">
        {initials}
      </div>
      <span className="font-medium text-gray-900 text-base max-w-[180px] truncate">Hi {displayName}!</span>
    </div>
  )
} 