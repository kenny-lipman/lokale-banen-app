/**
 * Detail-page parser voor werkenindekempen.nl.
 *
 * Strategie: extract <script type="application/ld+json"> blocks,
 * vind JobPosting object, valideer met Zod-schema.
 *
 * Faalt LUID op invalid input — geen partial inserts.
 */

import { JobPostingLDSchema, type JobPostingLD } from "./types";

const JSON_LD_RE = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;

export class JobPostingValidationError extends Error {
  constructor(public url: string, public reason: unknown) {
    super(`Invalid JSON-LD at ${url}: ${typeof reason === "string" ? reason : JSON.stringify(reason).slice(0, 300)}`);
    this.name = "JobPostingValidationError";
  }
}

export function parseDetailHtml(html: string, url: string): JobPostingLD {
  const blocks = Array.from(html.matchAll(JSON_LD_RE));
  let candidate: unknown = null;

  for (const b of blocks) {
    try {
      const parsed = JSON.parse(b[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const jp = items.find(
        (x: unknown) => x !== null && typeof x === "object" && (x as { "@type"?: string })["@type"] === "JobPosting"
      );
      if (jp) {
        candidate = jp;
        break;
      }
    } catch {
      // malformed JSON-LD block — skip
    }
  }

  if (!candidate) {
    throw new JobPostingValidationError(url, "no JobPosting JSON-LD found");
  }

  const result = JobPostingLDSchema.safeParse(candidate);
  if (!result.success) {
    throw new JobPostingValidationError(url, result.error.issues);
  }
  return result.data;
}
