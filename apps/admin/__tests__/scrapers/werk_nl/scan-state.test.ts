import { describe, test, expect } from "vitest";
import { isPassDue, type ScanState } from "@/lib/scrapers/werk_nl/scan-state";

const DAY = 86_400_000;
const now = Date.parse("2026-06-10T00:00:00Z");

function state(partial: Partial<ScanState>): ScanState {
  return { id: 1, pass_cursor: 0, pass_started_at: null, pass_completed_at: null, ...partial };
}

describe("isPassDue", () => {
  test("actieve pass (cursor != 0) is nooit due", () => {
    expect(isPassDue(state({ pass_cursor: 42 }), now, 7)).toBe(false);
  });

  test("nooit eerder voltooid -> due", () => {
    expect(isPassDue(state({ pass_completed_at: null }), now, 7)).toBe(true);
  });

  test("laatst voltooid langer dan staleDays geleden -> due", () => {
    expect(isPassDue(state({ pass_completed_at: new Date(now - 8 * DAY).toISOString() }), now, 7)).toBe(true);
  });

  test("recent voltooid -> niet due", () => {
    expect(isPassDue(state({ pass_completed_at: new Date(now - 2 * DAY).toISOString() }), now, 7)).toBe(false);
  });
});
