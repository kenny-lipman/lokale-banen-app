import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Variant = 'outline' | 'primary'

type CommonProps = {
  variant?: Variant
  className?: string
  children: React.ReactNode
}

type ButtonProps = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined
  }

type LinkProps = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string
  }

type Props = ButtonProps | LinkProps

const baseClasses = cn(
  'inline-flex items-center justify-center gap-3',
  'h-11 px-5 rounded-button',
  'font-bold text-meta tracking-tight',
  'whitespace-nowrap transition-colors duration-150 ease-eyeron',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary focus-visible:outline-offset-2',
  'disabled:pointer-events-none'
)

const variantClasses: Record<Variant, string> = {
  outline: cn(
    'border border-primary bg-transparent text-primary',
    'hover:bg-primary-tint active:bg-primary-tint-strong',
    'disabled:border-body disabled:text-body'
  ),
  primary: cn(
    'border border-primary bg-primary text-primary-ink',
    'hover:bg-primary-hover active:bg-primary-active'
  ),
}

/**
 * Pill-knop volgens Eyeron-spec — outline-stijl met 1px primary border,
 * 44px hoog, 20px border-radius, Tomica Bold tekst. Optionele primary
 * variant (gevuld) voor CTA-context.
 *
 * Werkt zowel als `<button>` als (met `href`) als Next.js `<Link>`.
 */
export function PillButton(props: Props) {
  const { variant = 'outline', className, children, ...rest } = props as Props & {
    variant?: Variant
    className?: string
    children: React.ReactNode
  }

  const classes = cn(baseClasses, variantClasses[variant], className)

  if ('href' in rest && rest.href) {
    const { href, ...anchorRest } = rest as LinkProps
    return (
      <Link href={href} className={classes} {...anchorRest}>
        {children}
      </Link>
    )
  }

  return (
    <button className={classes} {...(rest as ButtonProps)}>
      {children}
    </button>
  )
}
