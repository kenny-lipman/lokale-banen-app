import { z } from 'zod'

export const uuidSchema = z.string().uuid()

// PATCH /api/cities/[id] — alle velden optioneel, minstens 1 vereist
export const cityPatchSchema = z
  .object({
    plaats: z.string().trim().min(1).max(120).optional(),
    postcode: z
      .string()
      .trim()
      .regex(/^\d{4}$/, 'postcode moet 4 cijfers zijn')
      .nullable()
      .optional(),
    platform_id: uuidSchema.nullable().optional(),
    is_active: z.boolean().optional(),
    // Optimistic-lock token
    if_updated_at: z.string().datetime().optional(),
  })
  .refine(
    (data) =>
      data.plaats !== undefined ||
      data.postcode !== undefined ||
      data.platform_id !== undefined ||
      data.is_active !== undefined,
    { message: 'minstens 1 veld vereist' },
  )

export type CityPatchInput = z.infer<typeof cityPatchSchema>

// POST /api/cities/bulk-link
export const bulkLinkSchema = z.object({
  ids: z.array(uuidSchema).min(1, 'minstens 1 id').max(1000, 'max 1000 ids per request'),
  platform_id: uuidSchema.nullable().optional(),
  activate: z.boolean().optional(),
}).refine(
  (data) => 'platform_id' in data || 'activate' in data,
  { message: 'platform_id of activate vereist' },
)

export type BulkLinkInput = z.infer<typeof bulkLinkSchema>

// POST /api/cities/pending-jobs-count
export const pendingJobsSchema = z.object({
  ids: z.array(uuidSchema).min(1).max(1000),
})

export type PendingJobsInput = z.infer<typeof pendingJobsSchema>
