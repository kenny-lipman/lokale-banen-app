/**
 * Utility functions for debanensite scraper
 * Provides normalized_name and content_hash generation for deduplication
 */

/**
 * Generate normalized company name for deduplication
 * Pattern from n8n workflow: lowercase, no special chars, single spaces
 */
export function generateNormalizedName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/gi, "") // Remove special characters
    .replace(/\s+/g, " ") // Multiple spaces to single
    .trim();
}

/**
 * Generate content hash for job posting deduplication
 * Pattern from n8n workflow: base64 of position+company+location+url
 */
export function generateContentHash(
  title: string,
  company: string,
  city: string,
  url: string
): string {
  const raw = `${title || ""}${company || ""}${city || ""}${url || ""}`;
  return Buffer.from(raw).toString("base64");
}

/**
 * Parse name into first_name and last_name
 */
export function parseName(fullName: string): { firstName: string | null; lastName: string | null } {
  if (!fullName || !fullName.trim()) {
    return { firstName: null, lastName: null };
  }

  const nameParts = fullName.trim().split(/\s+/);
  if (nameParts.length >= 2) {
    return {
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(" "),
    };
  }
  return {
    firstName: fullName.trim(),
    lastName: null,
  };
}
