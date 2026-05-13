/**
 * Registry consistency-test.
 *
 * Garandeert dat alle displayStats keys uit de automations-registry
 * daadwerkelijk in de ScraperStats output van werkenindekempen-scraper voorkomen.
 *
 * Bij mismatch verschijnt het veld als "—" in /automatiseringen UI.
 */

import { describe, test, expect } from "vitest";
import { AUTOMATIONS } from "@/lib/automations-registry";
import { EMPTY_STATS } from "@/lib/scrapers/werkenindekempen/types";

describe("automations-registry: werkenindekempen-scraper", () => {
  const entry = AUTOMATIONS.find((a) => a.id === "werkenindekempen-scraper");

  test("entry bestaat", () => {
    expect(entry).toBeDefined();
  });

  test("alle displayStats keys bestaan in EMPTY_STATS", () => {
    if (!entry) throw new Error("entry missing");
    const producedKeys = Object.keys(EMPTY_STATS);
    for (const ds of entry.displayStats) {
      expect(producedKeys, `Key "${ds.key}" niet in ScraperStats`).toContain(ds.key);
    }
  });

  test("primaryStatKey is een geldige stat-key", () => {
    if (!entry) throw new Error("entry missing");
    expect(Object.keys(EMPTY_STATS)).toContain(entry.primaryStatKey!);
  });

  test("handlerPath matcht route-locatie", () => {
    expect(entry?.handlerPath).toBe("/api/scrapers/werkenindekempen");
  });

  test("schedule = 30 5 * * * (07:30 NL winter, tussen baanindebuurt en debanensite)", () => {
    expect(entry?.schedule).toBe("30 5 * * *");
  });
});
