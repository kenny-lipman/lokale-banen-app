import { describe, expect, test } from "vitest";
import { hasTimeBudget, shouldCompleteFullPass } from "@/lib/scrapers/werk_nl/scan-progress";

describe("shouldCompleteFullPass", () => {
  test("completeert op een niet-lege laatste pagina volgens totalResults", () => {
    expect(shouldCompleteFullPass(3, 1, 41)).toBe(true);
    expect(shouldCompleteFullPass(2, 20, 41)).toBe(false);
  });

  test("completeert een lege pagina alleen als eerdere pagina's totalResults al dekken", () => {
    expect(shouldCompleteFullPass(3, 0, 40)).toBe(true);
    expect(shouldCompleteFullPass(3, 0, 41)).toBe(false);
  });

  test("faalt gesloten bij totalResults 0", () => {
    expect(shouldCompleteFullPass(1, 0, 0)).toBe(false);
  });
});

describe("hasTimeBudget", () => {
  test("is false op of na budgetgrens", () => {
    expect(hasTimeBudget(1_000, 2_999, 2_000)).toBe(true);
    expect(hasTimeBudget(1_000, 3_000, 2_000)).toBe(false);
  });
});
