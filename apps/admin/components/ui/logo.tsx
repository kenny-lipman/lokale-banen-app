import React from 'react'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'white' | 'monochrome'
}

const sizeClasses = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-12',
  xl: 'h-16',
}

const textSizeClasses = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
}

const variantClasses = {
  default: 'text-gray-900',
  white: 'text-white',
  monochrome: 'text-gray-900',
}

// Placeholder wordmark. Wordt later vervangen door echt OTIS logo.
export function Logo({ className = '', size = 'md', variant = 'default' }: LogoProps) {
  return (
    <span
      className={`inline-flex items-center font-extrabold tracking-tight leading-none ${sizeClasses[size]} ${textSizeClasses[size]} ${variantClasses[variant]} ${className}`}
      aria-label="OTIS"
    >
      <span>OT</span>
      <span className="text-orange-500">I</span>
      <span>S</span>
    </span>
  )
}
