/**
 * API client for Nationale Vacaturebank
 *
 * Fetches paginated job listings from the NVB public API.
 * Requires browser-like headers to avoid being blocked.
 */

import type { NvbApiResponse } from "./types";

const API_BASE =
  "https://api.nationalevacaturebank.nl/api/jobs/v3/sites/nationalevacaturebank.nl/jobs";

const HEADERS: Record<string, string> = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Referer: "https://www.nationalevacaturebank.nl/",
  Origin: "https://www.nationalevacaturebank.nl",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
};

/**
 * Fetch a single page of jobs from the NVB API with retry
 */
export async function fetchPage(
  page: number,
  limit = 100,
  retries = 3
): Promise<NvbApiResponse> {
  const url = `${API_BASE}?page=${page}&limit=${limit}&sort=date`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      const response = await fetch(url, {
        headers: HEADERS,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as NvbApiResponse;
    } catch (error) {
      const isLastAttempt = attempt === retries - 1;
      if (isLastAttempt) throw error;

      const backoff = (attempt + 1) * 2000;
      console.warn(
        `NVB API page ${page} attempt ${attempt + 1} failed, retrying in ${backoff}ms:`,
        error instanceof Error ? error.message : error
      );
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  throw new Error("Unreachable");
}
