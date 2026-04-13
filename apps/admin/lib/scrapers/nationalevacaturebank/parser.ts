/**
 * Parser for NVB API job data
 *
 * Transforms raw NVB API jobs into our job_postings format.
 * No AI needed — the API already returns structured JSON.
 */

import { stripHtmlTags, generateContentHash } from "../shared";
import type { NvbJob } from "./types";

/** Parsed job ready for database insertion */
export interface ParsedJob {
  external_vacancy_id: string;
  title: string;
  company_name: string;
  url: string;
  description: string;
  employment: string;
  job_type: string[];
  salary: string | null;
  working_hours_min: number | null;
  working_hours_max: number | null;
  education_level: string;
  career_level: string;
  categories: string;
  industries: string;
  location: string;
  city: string;
  province: string;
  zipcode: string;
  street: string;
  latitude: number | null;
  longitude: number | null;
  start_date: string;
  end_date: string;
  contact_email: string | null;
  contact_phone: string | null;
  company_website: string | null;
  content_hash: string;
}

/**
 * Parse a single NVB job into our format
 */
export function parseJob(job: NvbJob): ParsedJob | null {
  if (!job.id || !job.title) return null;

  const companyName = job.company?.name || "";
  if (!companyName) return null;

  const description = job.description
    ? stripHtmlTags(job.description)
    : "";
  const city = job.workLocation?.city || "";
  const url = job._links?.detail?.href || "";

  const hoursMin = job.workingHours?.min ?? null;
  const hoursMax = job.workingHours?.max ?? null;
  const jobType: string[] = [];
  if (hoursMin !== null && hoursMin >= 36) jobType.push("Fulltime");
  if (hoursMin !== null && hoursMin < 36) jobType.push("Parttime");

  const salaryMin = job.salary?.min;
  const salaryMax = job.salary?.max;
  const salary =
    salaryMin || salaryMax
      ? `${salaryMin || ""} - ${salaryMax || ""}`.trim()
      : null;

  return {
    external_vacancy_id: job.id,
    title: job.title || job.functionTitle || "",
    company_name: companyName,
    url,
    description,
    employment: job.contractTypes?.join(", ") || job.contractType || "",
    job_type: jobType,
    salary,
    working_hours_min: hoursMin,
    working_hours_max: hoursMax,
    education_level: job.educationLevel || "",
    career_level: job.careerLevel || "",
    categories: job.categories?.join(", ") || "",
    industries: job.industries?.join(", ") || "",
    location: job.workLocation?.displayName || city,
    city,
    province: job.workLocation?.province || "",
    zipcode: job.workLocation?.zipCode || "",
    street: job.workLocation?.street || "",
    latitude: job.workLocation?.geolocation?.latitude
      ? parseFloat(String(job.workLocation.geolocation.latitude))
      : null,
    longitude: job.workLocation?.geolocation?.longitude
      ? parseFloat(String(job.workLocation.geolocation.longitude))
      : null,
    start_date: job.startDate || "",
    end_date: job.endDate || "",
    contact_email: job.contact?.emailAddress || null,
    contact_phone: job.contact?.phoneNumber || null,
    company_website:
      job.contact?.website || job.company?.website || null,
    content_hash: generateContentHash(
      job.title || "",
      companyName,
      city,
      url
    ),
  };
}
