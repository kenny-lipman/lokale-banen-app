import { z } from 'zod'

const urlOrDomain = z
  .string()
  .min(1, 'URL is verplicht')
  .refine((v) => {
    try {
      const s = /^https?:\/\//i.test(v) ? v : `https://${v}`
      const u = new URL(s)
      return u.hostname.includes('.')
    } catch {
      return false
    }
  }, 'Voer een geldig domein of URL in')

export const MAX_URLS_PER_BATCH = 25

export const stap1FormSchema = z.object({
  input_urls: z
    .array(urlOrDomain)
    .min(1, 'Voer minstens één URL in')
    .max(MAX_URLS_PER_BATCH, `Maximum ${MAX_URLS_PER_BATCH} URLs per batch`),
  owner_config_id: z.string().uuid('Kies een dealeigenaar'),
  scrape_vacancies: z.boolean().default(true),
  manual_vacancies: z
    .array(
      z.object({
        title: z.string().min(1),
        url: z.string().optional(),
        location: z.string().optional(),
      }),
    )
    .default([]),
})

export type Stap1FormValues = z.infer<typeof stap1FormSchema>

export const patchPayloadSchema = z.object({
  master_record: z.unknown().optional(),
  selected_contacts: z.array(z.unknown()).max(5).optional(),
})
export type PatchPayload = z.infer<typeof patchPayloadSchema>
