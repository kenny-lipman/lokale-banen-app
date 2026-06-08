/**
 * Mapt een werk.nl detail-payload naar een job_postings-patch + company/contact-input.
 *
 * Bemiddelaar-detectie is heuristisch: werk.nl heeft geen schoon signaal
 * (isByEmployerDirectly staat ook op true voor een zelf-plaatsend uitzendbureau).
 * Zie docs/superpowers/research/2026-06-05-werknl-detail-payload.md en CONTEXT.md.
 */

import type { WerknlDetail } from "./detail-types";
import { titleCaseCity } from "./mappers";
import { extractCompanyEvidence } from "./company-evidence";

export interface WerknlCompanyInput {
  werknl_employer_id: string | null;
  name: string;
  website: string | null;
  match_domains: string[];
  city: string | null;
  postal_code: string | null;
  street_address: string | null;
  is_bemiddelaar: boolean;
}

export interface WerknlContactInput {
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface MappedDetail {
  jobPatch: Record<string, unknown>;
  company: WerknlCompanyInput | null;
  contact: WerknlContactInput | null;
  isBemiddelaar: boolean;
  expiresAt: string | null;
}

/** Keyword-heuristiek voor bemiddelaar (uitzend/detach/werving/...). Conservatief om false positives te beperken. */
const BEMIDDELAAR_KEYWORDS = [
  "uitzend",
  "detach",
  "payroll",
  "werving",
  "recruit",
  "interim",
  "staffing",
  "secondment",
  "bemiddel",
  "flexpool",
  "flexkracht",
];

export function isBemiddelaar(name: string | null | undefined, website: string | null | undefined): boolean {
  const haystack = `${name ?? ""} ${website ?? ""}`.toLowerCase();
  return BEMIDDELAAR_KEYWORDS.some((kw) => haystack.includes(kw));
}

export function mapDetail(detail: WerknlDetail): MappedDetail {
  const prop = detail.proposition;
  const emp = detail.employer;
  const cp = detail.contactPerson;
  const evidence = extractCompanyEvidence(detail);

  const detailCity = titleCaseCity(prop?.workLocation?.city);
  const description = detail.description?.trim() || prop?.function?.description?.trim() || null;
  const jobPatch: Record<string, unknown> = {
    description,
    salary: prop?.salary?.amountIndication?.trim() || null,
    working_hours_min: prop?.workhours?.minimumHours ?? null,
    working_hours_max: prop?.workhours?.maximumHours ?? null,
    education_level: detail.cvOffer?.educationLevel?.name?.trim() || null,
    acquisition_not_appreciated: detail.isAcquisitionNotAppreciated ?? false,
  };
  // city/location alleen overschrijven als de detail een stad heeft (anders niet de
  // lijst-waarde nullen). location is nodig voor de geocoding-worker (filter op location).
  if (detailCity) {
    jobPatch.city = detailCity;
    jobPatch.location = detailCity;
  }
  if (detail.title?.trim()) jobPatch.title = detail.title.trim();

  const bemiddelaar = emp ? isBemiddelaar(emp.organizationName, emp.website) : false;

  const company: WerknlCompanyInput | null =
    emp && emp.organizationName?.trim()
      ? {
          werknl_employer_id: evidence.werknlEmployerId,
          name: emp.organizationName.trim(),
          website: evidence.employerWebsiteDomain ? emp.website?.trim() || null : null,
          match_domains: evidence.trustedDomains,
          city: titleCaseCity(emp.addressNetherlands?.city),
          postal_code: emp.addressNetherlands?.postcode?.trim() || null,
          street_address: emp.addressNetherlands?.streetName?.trim() || null,
          is_bemiddelaar: bemiddelaar,
        }
      : null;

  const contact: WerknlContactInput | null =
    cp && (cp.name?.trim() || cp.email?.trim())
      ? {
          name: cp.name?.trim() || null,
          email: cp.email?.trim() || null,
          phone: cp.phoneNumber?.trim() || null,
        }
      : null;

  return {
    jobPatch,
    company,
    contact,
    isBemiddelaar: bemiddelaar,
    expiresAt: detail.expirationDate?.trim() || null,
  };
}
