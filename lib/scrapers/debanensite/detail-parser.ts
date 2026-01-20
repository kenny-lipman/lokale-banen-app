/**
 * Detail page parser for debanensite.nl
 * Extracts Schema.org JSON-LD data from vacancy detail pages
 */

import * as cheerio from "cheerio";
import type { DetailPageData } from "./types";

/**
 * Parse Schema.org JSON-LD from detail page HTML
 */
export function parseDetailPage(html: string): DetailPageData {
  const emptyResult: DetailPageData = {
    datePosted: null,
    validThrough: null,
    province: null,
    workField: null,
    educationLevel: null,
    companyAddress: null,
  };

  try {
    const $ = cheerio.load(html);

    // Find JSON-LD script tag
    const jsonLdScript = $('script[type="application/ld+json"]').html();
    if (!jsonLdScript) {
      return emptyResult;
    }

    const jsonLd = JSON.parse(jsonLdScript);

    // Handle array of JSON-LD objects (find JobPosting)
    const jobPosting = Array.isArray(jsonLd)
      ? jsonLd.find((item) => item["@type"] === "JobPosting")
      : jsonLd["@type"] === "JobPosting"
        ? jsonLd
        : null;

    if (!jobPosting) {
      return emptyResult;
    }

    // Extract company address
    let companyAddress: DetailPageData["companyAddress"] = null;
    if (jobPosting.hiringOrganization?.address) {
      const addr = jobPosting.hiringOrganization.address;
      companyAddress = {
        streetAddress: addr.streetAddress || null,
        postalCode: addr.postalCode || null,
        city: addr.addressLocality || null,
      };
    }

    // Extract education level - can be string or object
    let educationLevel: string | null = null;
    if (jobPosting.educationRequirements) {
      if (typeof jobPosting.educationRequirements === "string") {
        educationLevel = jobPosting.educationRequirements;
      } else if (jobPosting.educationRequirements.credentialCategory) {
        educationLevel = jobPosting.educationRequirements.credentialCategory;
      }
    }

    return {
      datePosted: jobPosting.datePosted || null,
      validThrough: jobPosting.validThrough || null,
      province: jobPosting.jobLocation?.address?.addressRegion || null,
      workField: jobPosting.occupationalCategory || null,
      educationLevel,
      companyAddress,
    };
  } catch (error) {
    console.error("Failed to parse detail page JSON-LD:", error);
    return emptyResult;
  }
}

/**
 * Fetch and parse detail page
 */
export async function fetchDetailPage(
  url: string,
  retries = 2
): Promise<DetailPageData | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LokaleBanen/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (!response.ok) {
        if (attempt === retries) {
          console.error(`Failed to fetch detail page (HTTP ${response.status}): ${url}`);
          return null;
        }
        await delay(500 * (attempt + 1));
        continue;
      }

      const html = await response.text();
      return parseDetailPage(html);
    } catch (error) {
      if (attempt === retries) {
        console.error(`Failed to fetch detail page: ${url}`, error);
        return null;
      }
      await delay(500 * (attempt + 1));
    }
  }
  return null;
}

/**
 * Simple delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
