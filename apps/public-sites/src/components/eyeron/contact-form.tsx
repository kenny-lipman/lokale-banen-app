'use client'

import { useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { submitContactForm, type ContactFormResult } from '@/app/actions/contact'
import { PillButton } from './pill-button'

/**
 * Contactformulier - server-action submit naar info@lokalebanen.nl.
 * Honeypot `website` veld tegen bots, server-side rate-limit per IP.
 *
 * UX:
 * - Inline validation feedback
 * - useTransition zodat de button disabled tijdens submit
 * - Resultaat via aria-live region voor screen readers
 */
export function ContactForm() {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ContactFormResult | null>(null)

  function handleSubmit(formData: FormData) {
    setResult(null)
    startTransition(async () => {
      const res = await submitContactForm(formData)
      setResult(res)
      if (res.ok) {
        // Reset alleen bij success
        const form = document.querySelector<HTMLFormElement>('form[data-contact-form]')
        form?.reset()
      }
    })
  }

  return (
    <form
      action={handleSubmit}
      data-contact-form
      className="space-y-4"
      noValidate
    >
      {/* Honeypot - verborgen voor users, bots vullen 'm vaak in */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}
      >
        <label htmlFor="cf-website">Website</label>
        <input
          id="cf-website"
          name="website"
          type="text"
          autoComplete="off"
          tabIndex={-1}
        />
      </div>

      <Field
        label="Naam"
        name="name"
        type="text"
        required
        autoComplete="name"
        disabled={pending}
      />
      <Field
        label="E-mail"
        name="email"
        type="email"
        required
        autoComplete="email"
        disabled={pending}
      />
      <Field
        label="Onderwerp"
        name="subject"
        type="text"
        disabled={pending}
      />

      <div>
        <label
          htmlFor="cf-message"
          className="block text-meta font-bold text-primary tracking-tight mb-1.5"
        >
          Bericht <span className="text-secondary">*</span>
        </label>
        <textarea
          id="cf-message"
          name="message"
          required
          rows={6}
          maxLength={5000}
          disabled={pending}
          className="w-full px-4 py-3 rounded-input border border-divider bg-surface text-body text-primary placeholder:text-placeholder outline-none focus-visible:border-secondary focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--secondary)_25%,transparent)] disabled:opacity-60"
        />
      </div>

      <div className="flex items-center gap-4">
        <PillButton
          type="submit"
          variant="primary"
          size="lg"
          disabled={pending}
          className="disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Send className="size-4" strokeWidth={2} aria-hidden="true" />
          {pending ? 'Versturen...' : 'Verstuur bericht'}
        </PillButton>
      </div>

      {result && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 text-meta font-regular ${
            result.ok ? 'text-secondary' : 'text-red-600'
          }`}
        >
          {result.message}
        </p>
      )}
    </form>
  )
}

interface FieldProps {
  label: string
  name: string
  type: 'text' | 'email'
  required?: boolean
  autoComplete?: string
  disabled?: boolean
}

function Field({ label, name, type, required, autoComplete, disabled }: FieldProps) {
  const id = `cf-${name}`
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-meta font-bold text-primary tracking-tight mb-1.5"
      >
        {label}
        {required && <span className="text-secondary"> *</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        className="w-full h-11 px-4 rounded-input border border-divider bg-surface text-body text-primary placeholder:text-placeholder outline-none focus-visible:border-secondary focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--secondary)_25%,transparent)] disabled:opacity-60"
      />
    </div>
  )
}
