// Client factories
export { createPublicClient, createServiceClient } from './client'

// Slug utilities
export { generateSlug, extractIdFromSlug, slugifyCity, generateCompanySlug } from './slug'

// Markdown conversion
export { htmlToMarkdown } from './markdown'

// Query helpers
export {
  getApprovedJobs,
  getApprovedJobsCount,
  getJobBySlug,
  getRelatedJobs,
  getTenantByDomain,
  getPublicPlatforms,
  getMasterTenant,
  getSavedJobs,
  saveJob,
  removeSavedJob,
  logApplication,
} from './queries'
export type { GetApprovedJobsOptions } from './queries'

// Types
export type {
  Database,
  JobPosting,
  Platform,
  SavedJob,
  JobApplication,
} from './types'
