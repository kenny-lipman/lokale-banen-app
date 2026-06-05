import { describe, test, expect } from "vitest";
import { mapSearchItem } from "@/lib/scrapers/werk_nl/mappers";
import type { SearchItem } from "@/lib/scrapers/werk_nl/types";

const base: SearchItem = {
  key: "2001:L:123",
  referenceNumber: 123,
  vacatureTitle: "Verpleegkundige gezocht",
  profession: "Verpleegkundige",
  organisation: "Zorg BV",
  workLocationCity: "TERNEUZEN",
  minHours: 24,
  maxHours: 36,
  contractType: "Vast",
  studyLevel: "MBO",
};

describe("mapSearchItem", () => {
  test("mapt kernvelden + zet detail-vlag en pending review", () => {
    const row = mapSearchItem(base, "src-1", "2026-06-05T10:00:00.000Z");
    expect(row.title).toBe("Verpleegkundige gezocht");
    expect(row.external_vacancy_id).toBe("123");
    expect(row.source_id).toBe("src-1");
    expect(row.city).toBe("Terneuzen"); // title-case
    expect(row.url).toBe("https://www.werk.nl/werkzoekenden/mijn-werkmap/kia/publiek/zoekenvacatures/api/vacature/123");
    expect(row.working_hours_min).toBe(24);
    expect(row.working_hours_max).toBe(36);
    expect(row.review_status).toBe("pending");
    expect(row.company_id).toBeNull();
    // bewust geen needs_detail_scrape: die vlag is eigendom van de career-page flow
    expect("needs_detail_scrape" in row).toBe(false);
  });

  test("valt terug op profession als vacatureTitle ontbreekt", () => {
    const row = mapSearchItem({ ...base, vacatureTitle: null }, "src-1", "2026-06-05T10:00:00.000Z");
    expect(row.title).toBe("Verpleegkundige");
  });

  test("lege city wordt null, niet lege string", () => {
    const row = mapSearchItem({ ...base, workLocationCity: null }, "src-1", "2026-06-05T10:00:00.000Z");
    expect(row.city).toBeNull();
  });
});
