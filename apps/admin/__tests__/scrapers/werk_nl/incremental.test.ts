import { describe, test, expect } from "vitest";
import { pageAllKnown, shouldStopIncremental } from "@/lib/scrapers/werk_nl/incremental";

describe("pageAllKnown", () => {
  test("alle 'seen' -> true", () => {
    expect(pageAllKnown(["seen", "seen", "seen"])).toBe(true);
  });
  test("een 'new' erbij -> false", () => {
    expect(pageAllKnown(["seen", "new", "seen"])).toBe(false);
  });
  test("lege pagina -> false (geen stop-signaal op leeg)", () => {
    expect(pageAllKnown([])).toBe(false);
  });
});

describe("shouldStopIncremental", () => {
  test("stopt bij bereiken drempel", () => {
    expect(shouldStopIncremental(2, 2)).toBe(true);
    expect(shouldStopIncremental(3, 2)).toBe(true);
  });
  test("gaat door onder de drempel", () => {
    expect(shouldStopIncremental(1, 2)).toBe(false);
    expect(shouldStopIncremental(0, 2)).toBe(false);
  });
});
