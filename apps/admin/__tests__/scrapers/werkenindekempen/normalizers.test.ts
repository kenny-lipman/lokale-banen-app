import { describe, test, expect } from "vitest";
import * as N from "@/lib/scrapers/werkenindekempen/normalizers";

describe("normalizeCity", () => {
  test("uppercase → titlecase", () => {
    expect(N.normalizeCity("HELMOND")).toBe("Helmond");
  });
  test("lowercase → titlecase", () => {
    expect(N.normalizeCity("eindhoven")).toBe("Eindhoven");
  });
  test("multi-word", () => {
    expect(N.normalizeCity("son en breugel")).toBe("Son En Breugel");
  });
  test("'s-Hertogenbosch quirk", () => {
    expect(N.normalizeCity("s-Hertogenbosch")).toBe("'s-Hertogenbosch");
    expect(N.normalizeCity("S-HERTOGENBOSCH")).toBe("'s-Hertogenbosch");
  });
  test("null/undefined/empty", () => {
    expect(N.normalizeCity(null)).toBe(null);
    expect(N.normalizeCity(undefined)).toBe(null);
    expect(N.normalizeCity("")).toBe(null);
    expect(N.normalizeCity("   ")).toBe(null);
  });
});

describe("normalizeRegion", () => {
  test("NB → Noord-Brabant", () => {
    expect(N.normalizeRegion("NB")).toBe("Noord-Brabant");
  });
  test("nb (lowercase) → Noord-Brabant", () => {
    expect(N.normalizeRegion("nb")).toBe("Noord-Brabant");
  });
  test("ZH → Zuid-Holland", () => {
    expect(N.normalizeRegion("ZH")).toBe("Zuid-Holland");
  });
  test("unknown code → passthrough", () => {
    expect(N.normalizeRegion("XX")).toBe("XX");
  });
  test("null", () => {
    expect(N.normalizeRegion(null)).toBe(null);
  });
});

describe("normalizeCountry", () => {
  test("NL → Netherlands", () => {
    expect(N.normalizeCountry("NL")).toBe("Netherlands");
  });
  test("NLD → Netherlands", () => {
    expect(N.normalizeCountry("NLD")).toBe("Netherlands");
  });
  test("netherlands (mixed case) → Netherlands", () => {
    expect(N.normalizeCountry("netherlands")).toBe("Netherlands");
  });
  test("BE → passthrough", () => {
    expect(N.normalizeCountry("BE")).toBe("BE");
  });
});

describe("normalizeEmploymentType", () => {
  test("JSON-string array", () => {
    expect(N.normalizeEmploymentType('["FULL_TIME","PART_TIME"]')).toEqual({
      types: ["FULL_TIME", "PART_TIME"],
      labels: ["Fulltime", "Parttime"],
      label: "Fulltime/Parttime",
    });
  });
  test("plain array FULL_TIME only", () => {
    expect(N.normalizeEmploymentType(["FULL_TIME"])).toEqual({
      types: ["FULL_TIME"],
      labels: ["Fulltime"],
      label: "Fulltime",
    });
  });
  test("plain array PART_TIME only", () => {
    expect(N.normalizeEmploymentType(["PART_TIME"])).toEqual({
      types: ["PART_TIME"],
      labels: ["Parttime"],
      label: "Parttime",
    });
  });
  test("plain string single", () => {
    expect(N.normalizeEmploymentType("FULL_TIME")).toEqual({
      types: ["FULL_TIME"],
      labels: ["Fulltime"],
      label: "Fulltime",
    });
  });
  test("undefined → empty", () => {
    expect(N.normalizeEmploymentType(undefined)).toEqual({ types: [], labels: [], label: null });
  });
  test("null → empty", () => {
    expect(N.normalizeEmploymentType(null)).toEqual({ types: [], labels: [], label: null });
  });
  test("contractor → Freelance", () => {
    expect(N.normalizeEmploymentType(["CONTRACTOR"])).toEqual({
      types: ["CONTRACTOR"],
      labels: ["Freelance"],
      label: "Freelance",
    });
  });
  test("intern → Stage", () => {
    expect(N.normalizeEmploymentType("INTERN")).toEqual({
      types: ["INTERN"],
      labels: ["Stage"],
      label: "Stage",
    });
  });
});

describe("parseSalary", () => {
  test("range MONTH (string)", () => {
    const r = N.parseSalary({
      currency: "EUR",
      value: { value: "2580.00 - 4000.00", unitText: "MONTH" },
    });
    expect(r.min).toBe(2580);
    expect(r.max).toBe(4000);
    expect(r.period).toBe("MONTH");
    expect(r.displayLabel).toContain("per maand");
  });
  test("single HOUR", () => {
    const r = N.parseSalary({ value: { value: "12.50", unitText: "HOUR" } });
    expect(r.min).toBe(12.5);
    expect(r.max).toBe(null);
    expect(r.displayLabel).toContain("per uur");
  });
  test("minValue/maxValue numeric", () => {
    const r = N.parseSalary({
      currency: "EUR",
      value: { minValue: 3000, maxValue: 4500, unitText: "MONTH" },
    });
    expect(r.min).toBe(3000);
    expect(r.max).toBe(4500);
  });
  test("YEAR period", () => {
    const r = N.parseSalary({ value: { minValue: 60000, unitText: "YEAR" } });
    expect(r.min).toBe(60000);
    expect(r.period).toBe("YEAR");
    expect(r.displayLabel).toContain("per jaar");
  });
  test("empty input", () => {
    expect(N.parseSalary({}).min).toBe(null);
    expect(N.parseSalary(null).min).toBe(null);
    expect(N.parseSalary(undefined).min).toBe(null);
  });
  test("missing value → null", () => {
    expect(N.parseSalary({ currency: "EUR" }).min).toBe(null);
  });
});

describe("normalizePostalCode", () => {
  test("no-space format", () => {
    expect(N.normalizePostalCode("5087BB")).toBe("5087 BB");
  });
  test("with-space format", () => {
    expect(N.normalizePostalCode("5087 BB")).toBe("5087 BB");
  });
  test("lowercase letters", () => {
    expect(N.normalizePostalCode("5087bb")).toBe("5087 BB");
  });
  test("invalid → passthrough", () => {
    expect(N.normalizePostalCode("WTF")).toBe("WTF");
  });
  test("null", () => {
    expect(N.normalizePostalCode(null)).toBe(null);
  });
});

describe("parsePublishedAt", () => {
  test("zomertijd → +02:00", () => {
    const out = N.parsePublishedAt("2026-07-15");
    expect(out).toMatch(/^2026-07-15T00:00:00\+02:00$/);
  });
  test("wintertijd → +01:00", () => {
    const out = N.parsePublishedAt("2026-12-15");
    expect(out).toMatch(/^2026-12-15T00:00:00\+01:00$/);
  });
  test("ISO datetime input → date-only used", () => {
    const out = N.parsePublishedAt("2026-05-12T10:30:00Z");
    expect(out).toMatch(/^2026-05-12T00:00:00\+0[12]:00$/);
  });
});

describe("parseUrlSegments", () => {
  test("valid full URL", () => {
    const r = N.parseUrlSegments(
      "https://www.werkenindekempen.nl/vacatures/plaatwerker-sheet-metal-specialist-27265-1778619733-c1913"
    );
    expect(r).toEqual({
      slug: "plaatwerker-sheet-metal-specialist",
      jobId: "27265",
      unixTs: 1778619733,
      companyExtId: "1913",
    });
  });
  test("short slug", () => {
    const r = N.parseUrlSegments(
      "https://www.werkenindekempen.nl/vacatures/abc-1-2-c3"
    );
    expect(r).toEqual({ slug: "abc", jobId: "1", unixTs: 2, companyExtId: "3" });
  });
  test("invalid URL → null", () => {
    expect(N.parseUrlSegments("https://example.com/foo")).toBe(null);
    expect(N.parseUrlSegments("/vacatures/no-numbers-here")).toBe(null);
  });
});

describe("stripHtml", () => {
  test("removes tags", () => {
    expect(N.stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });
  test("entities", () => {
    expect(N.stripHtml("AT&amp;T &nbsp; rocks")).toBe("AT&T rocks");
  });
  test("null/empty", () => {
    expect(N.stripHtml(null)).toBe("");
    expect(N.stripHtml("")).toBe("");
  });
});

describe("extractHoofddomein", () => {
  test("https + www", () => {
    expect(N.extractHoofddomein("https://www.example.com/path")).toBe("example.com");
  });
  test("http + no-www", () => {
    expect(N.extractHoofddomein("http://example.com")).toBe("example.com");
  });
  test("uppercase", () => {
    expect(N.extractHoofddomein("https://WWW.Example.COM")).toBe("example.com");
  });
  test("no protocol", () => {
    expect(N.extractHoofddomein("example.com")).toBe("example.com");
  });
  test("invalid", () => {
    expect(N.extractHoofddomein("not a url")).toBe(null);
    expect(N.extractHoofddomein(null)).toBe(null);
  });
});
