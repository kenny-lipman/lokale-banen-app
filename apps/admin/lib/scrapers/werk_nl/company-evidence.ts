import type { WerknlDetail } from "./detail-types";

const GENERIC_COMPANY_DOMAINS = new Set([
  "applyonwebsite.com",
  "easyapply.jobs",
  "foundub.nl",
  "joblink.nl",
  "multiposter.nl",
  "nationalevacaturebank.nl",
  "nowonline.nl",
  "recruitmenttechnologies.com",
  "uitzendbureau.nl",
]);

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "msn.com",
  "outlook.com",
  "yahoo.com",
]);

const TWO_PART_TLDS = new Set(["co.uk", "com.au", "co.nz"]);

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeWerknlEmployerId(referenceNumber: number | null | undefined): string | null {
  return referenceNumber != null && referenceNumber > 0 ? String(referenceNumber) : null;
}

export function rootDomain(value: string | null | undefined): string | null {
  const trimmed = clean(value);
  if (!trimmed) return null;

  const emailMatch = trimmed.match(/@([^\s>]+)/);
  const raw = emailMatch ? emailMatch[1] : trimmed;
  const withProtocol = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const host = new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
    const parts = host.split(".").filter(Boolean);
    if (parts.length <= 2) return host;
    const suffix = parts.slice(-2).join(".");
    if (TWO_PART_TLDS.has(suffix) && parts.length >= 3) return parts.slice(-3).join(".");
    return parts.slice(-2).join(".");
  } catch {
    return null;
  }
}

export function emailDomain(email: string | null | undefined): string | null {
  const domain = rootDomain(email);
  if (!domain || PUBLIC_EMAIL_DOMAINS.has(domain)) return null;
  return domain;
}

export function isGenericCompanyDomain(domain: string | null | undefined): boolean {
  return !domain || GENERIC_COMPANY_DOMAINS.has(domain);
}

function trustedDomain(domain: string | null | undefined): string | null {
  return domain && !isGenericCompanyDomain(domain) ? domain : null;
}

function unique(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export interface CompanyEvidence {
  werknlEmployerId: string | null;
  employerWebsiteDomain: string | null;
  contactEmailDomain: string | null;
  applicationDomains: string[];
  trustedDomains: string[];
}

export function extractCompanyEvidence(detail: WerknlDetail): CompanyEvidence {
  const employerWebsiteDomain = trustedDomain(rootDomain(detail.employer?.website));
  const contactDomain = trustedDomain(emailDomain(detail.contactPerson?.email));
  const applicationDomains = unique(
    (detail.applicationMethods ?? []).map((method) => trustedDomain(rootDomain(method.urlApplicationForm)))
  );

  return {
    werknlEmployerId: normalizeWerknlEmployerId(detail.employer?.referenceNumber),
    employerWebsiteDomain,
    contactEmailDomain: contactDomain,
    applicationDomains,
    trustedDomains: unique([employerWebsiteDomain, contactDomain, ...applicationDomains]),
  };
}
