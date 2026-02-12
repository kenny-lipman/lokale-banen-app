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
    salaryMin: null,
    salaryMax: null,
    salaryPeriod: null,
    logoUrl: null,
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

    // Extract company address - primary: jobLocation.address, fallback: hiringOrganization.address
    let companyAddress: DetailPageData["companyAddress"] = null;
    const addr = jobPosting.jobLocation?.address || jobPosting.hiringOrganization?.address;
    if (addr) {
      companyAddress = {
        streetAddress: addr.streetAddress || null,
        postalCode: addr.postalCode || null,
        city: addr.addressLocality || null,
      };
    }

    // Extract education level - primary: qualifications.educationalLevel, fallback: educationRequirements
    let educationLevel: string | null = null;
    if (jobPosting.qualifications?.educationalLevel) {
      educationLevel = jobPosting.qualifications.educationalLevel;
    } else if (jobPosting.educationRequirements) {
      if (typeof jobPosting.educationRequirements === "string") {
        educationLevel = jobPosting.educationRequirements;
      } else if (jobPosting.educationRequirements.credentialCategory) {
        educationLevel = jobPosting.educationRequirements.credentialCategory;
      }
    }

    // Extract salary from baseSalary
    let salaryMin: number | null = null;
    let salaryMax: number | null = null;
    let salaryPeriod: string | null = null;
    if (jobPosting.baseSalary?.value) {
      const salaryValue = jobPosting.baseSalary.value;
      salaryMin = salaryValue.minValue ?? salaryValue.value ?? null;
      salaryMax = salaryValue.maxValue ?? null;
      salaryPeriod = salaryValue.unitText || jobPosting.baseSalary.unitText || null;
    }

    // Extract company logo
    const logoUrl = jobPosting.hiringOrganization?.logo || null;

    return {
      datePosted: jobPosting.datePosted || null,
      validThrough: jobPosting.validThrough || null,
      province: jobPosting.jobLocation?.address?.addressRegion || null,
      workField: jobPosting.occupationalCategory || null,
      educationLevel,
      companyAddress,
      salaryMin,
      salaryMax,
      salaryPeriod,
      logoUrl,
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
