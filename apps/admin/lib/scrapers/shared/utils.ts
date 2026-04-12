/**
 * Shared utility functions for all scrapers
 */

/**
 * Delay helper for rate limiting
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize phone number for comparison
 * Removes all non-digits except leading +
 * Examples:
 *   "06-12345678" → "0612345678"
 *   "+31 6 12345678" → "+31612345678"
 *   "0297-300 203" → "0297300203"
 */
export function normalizePhone(phone: string): string {
  const hasPlus = phone.startsWith("+");
  const digits = phone.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Parse full name into first and last name
 * Examples:
 *   "Jan de Vries" → { firstName: "Jan", lastName: "de Vries" }
 *   "Jan" → { firstName: "Jan", lastName: null }
 */
export function parseName(fullName: string): {
  firstName: string | null;
  lastName: string | null;
} {
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
  return { firstName: fullName.trim(), lastName: null };
}

/**
 * Generate normalized company name for deduplication
 * Pattern: lowercase, no special chars, single spaces
 * Examples:
 *   "Van Walraven B.V." → "van walraven bv"
 *   "KLG Europe Venlo B.V." → "klg europe venlo bv"
 */
export function generateNormalizedName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate content hash for job posting deduplication
 * Pattern: base64 of position+company+location+url
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
 * Strip HTML tags from text
 */
export function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
