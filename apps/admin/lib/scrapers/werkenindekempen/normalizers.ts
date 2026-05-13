/**
 * Deterministische normalizers voor werkenindekempen-scraper data.
 *
 * Alle transform-logica op één plek. Unit-tested in
 * apps/admin/__tests__/scrapers/werkenindekempen/normalizers.test.ts
 */

const REGION_MAP: Record<string, string> = {
  DR: "Drenthe",
  FL: "Flevoland",
  FR: "Friesland",
  GE: "Gelderland",
  GR: "Groningen",
  LI: "Limburg",
  NB: "Noord-Brabant",
  NH: "Noord-Holland",
  OV: "Overijssel",
  UT: "Utrecht",
  ZE: "Zeeland",
  ZH: "Zuid-Holland",
};

/** Titlecase met 's-Hertogenbosch quirk. */
export function normalizeCity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  // 's-Hertogenbosch / s-Hertogenbosch
  if (lower.startsWith("'s-") || lower.startsWith("s-")) {
    const dashIdx = lower.indexOf("-");
    const rest = lower
      .slice(dashIdx + 1)
      .split(/(\s+|-)/)
      .map((part) => (part.length > 0 && !/\s|-/.test(part[0]) ? part[0].toUpperCase() + part.slice(1) : part))
      .join("");
    return "'s-" + rest;
  }
  return lower.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Province 2-letter code → volledige naam. Onbekend → onveranderd. */
export function normalizeRegion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const up = raw.toUpperCase().trim();
  return REGION_MAP[up] ?? raw;
}

/** ISO-2 country → display name. */
export function normalizeCountry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const up = raw.toUpperCase().trim();
  if (up === "NL" || up === "NLD" || up === "NETHERLANDS") return "Netherlands";
  return raw;
}

/**
 * employmentType kan zijn:
 * - JSON-string array: '["FULL_TIME","PART_TIME"]'
 * - Echte array: ["FULL_TIME"]
 * - Plain string: "FULL_TIME"
 * - undefined
 *
 * Returnt array van types + display-label.
 */
export function normalizeEmploymentType(raw: string | string[] | undefined | null): {
  types: string[];
  label: string | null;
} {
  let types: string[] = [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      types = Array.isArray(parsed) ? parsed : [raw];
    } catch {
      types = [raw];
    }
  } else if (Array.isArray(raw)) {
    types = raw;
  }
  types = types
    .map((t) => String(t).toUpperCase().trim())
    .filter((t) => t.length > 0);

  const hasFull = types.includes("FULL_TIME");
  const hasPart = types.includes("PART_TIME");

  let label: string | null = null;
  if (hasFull && hasPart) label = "Fulltime/Parttime";
  else if (hasFull) label = "Fulltime";
  else if (hasPart) label = "Parttime";
  else if (types.length) label = types.join("/");

  return { types, label };
}

export interface ParsedSalary {
  min: number | null;
  max: number | null;
  period: string | null;
  currency: string;
  displayLabel: string | null;
}

/** Parse baseSalary JSON-LD object naar gestructureerde + display-label. */
export function parseSalary(baseSalary: unknown): ParsedSalary {
  const empty: ParsedSalary = {
    min: null,
    max: null,
    period: null,
    currency: "EUR",
    displayLabel: null,
  };
  if (!baseSalary || typeof baseSalary !== "object") return empty;
  const bs = baseSalary as {
    currency?: string;
    unitText?: string;
    value?: {
      value?: string | number;
      minValue?: number;
      maxValue?: number;
      unitText?: string;
    };
  };
  if (!bs.value) return empty;
  const v = bs.value;
  const currency = bs.currency ?? "EUR";
  const unit = v.unitText ?? bs.unitText ?? null;

  let min: number | null = null;
  let max: number | null = null;
  if (typeof v.minValue === "number") {
    min = v.minValue;
    max = typeof v.maxValue === "number" ? v.maxValue : null;
  } else if (typeof v.value === "string" && v.value.includes("-")) {
    const parts = v.value.split("-").map((s) => parseFloat(s.trim()));
    if (Number.isFinite(parts[0])) min = parts[0];
    if (Number.isFinite(parts[1])) max = parts[1];
  } else if (v.value != null) {
    const n = typeof v.value === "number" ? v.value : parseFloat(String(v.value));
    if (Number.isFinite(n)) min = n;
  }

  if (min == null) return { ...empty, currency };

  const fmt = (n: number) =>
    n.toLocaleString("nl-NL", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  const periodMap: Record<string, string> = {
    MONTH: "per maand",
    YEAR: "per jaar",
    HOUR: "per uur",
    WEEK: "per week",
  };
  const periodLabel = unit ? periodMap[unit] ?? unit.toLowerCase() : "";
  const displayLabel =
    max != null
      ? `${fmt(min)} - ${fmt(max)}${periodLabel ? " " + periodLabel : ""}`
      : `${fmt(min)}${periodLabel ? " " + periodLabel : ""}`;

  return { min, max, period: unit, currency, displayLabel };
}

/** "5087BB" of "5087 BB" → "5087 BB". Onverwacht formaat → onveranderd. */
export function normalizePostalCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const clean = raw.replace(/\s+/g, "").toUpperCase();
  if (/^\d{4}[A-Z]{2}$/.test(clean)) return `${clean.slice(0, 4)} ${clean.slice(4)}`;
  return raw;
}

/**
 * Parse ISO-date als Europe/Amsterdam midnight; returnt ISO-string met +01:00/+02:00 offset.
 *
 * Voorkomt de klassieke "datePosted: 2026-05-12" → "2026-05-11T22:00:00Z" bug
 * (waarbij UTC-midnight = 2u terug in NL-time, een dag eerder valt).
 */
export function parsePublishedAt(isoDate: string): string {
  const dateOnly = isoDate.slice(0, 10);
  // Probe op 12:00 UTC ipv midnight. DST-transitie (laatste zondag maart om 02:00 NL)
  // valt op 00:00-03:00 UTC; 12:00 UTC zit veilig na de overgang.
  const probe = new Date(dateOnly + "T12:00:00Z");
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    timeZoneName: "shortOffset",
  });
  const tzName = fmt.formatToParts(probe).find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const m = tzName.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
  let hours = 1;
  let minutes = 0;
  if (m) {
    hours = parseInt(m[1], 10);
    if (m[2]) minutes = parseInt(m[2], 10);
  }
  const sign = hours >= 0 ? "+" : "-";
  const hh = String(Math.abs(hours)).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${dateOnly}T00:00:00${sign}${hh}:${mm}`;
}

/**
 * Parse werkenindekempen-detail-URL segmenten.
 * Pattern: /vacatures/{slug}-{job_id}-{unix_ts}-c{company_id}
 *
 * Voorbeeld: /vacatures/plaatwerker-sheet-metal-specialist-27265-1778619733-c1913
 */
export function parseUrlSegments(
  url: string
): { slug: string; jobId: string; unixTs: number; companyExtId: string } | null {
  const m = url.match(/\/vacatures\/(.+?)-(\d+)-(\d+)-c(\d+)$/);
  if (!m) return null;
  return {
    slug: m[1],
    jobId: m[2],
    unixTs: parseInt(m[3], 10),
    companyExtId: m[4],
  };
}

/** Strip HTML tags voor plain-text (search_vector, Mistral input). */
export function stripHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Hoofddomein uit URL (zonder www., lowercase). */
export function extractHoofddomein(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
