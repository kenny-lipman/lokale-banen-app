import { describe, test, expect } from "vitest";
import { archiveNotSeenSince } from "@/lib/scrapers/werk_nl/delisted";

function mockClient(count: number) {
  const captured: { patch?: any; filters: Array<[string, unknown]> } = { filters: [] };
  const builder: any = {
    eq: (col: string, val: unknown) => {
      captured.filters.push([`eq:${col}`, val]);
      return builder;
    },
    lt: (col: string, val: unknown) => {
      captured.filters.push([`lt:${col}`, val]);
      return builder;
    },
    is: (col: string, val: unknown) => {
      captured.filters.push([`is:${col}`, val]);
      return Promise.resolve({ count, error: null });
    },
  };
  const client = {
    from: () => ({
      update: (patch: Record<string, unknown>) => {
        captured.patch = patch;
        return builder;
      },
    }),
    _captured: captured,
  };
  return client;
}

describe("archiveNotSeenSince", () => {
  test("archiveert niet-gezien-sinds-pass en geeft aantal terug", async () => {
    const c = mockClient(7);
    const n = await archiveNotSeenSince(c as any, "src-1", "2026-06-05T00:00:00Z", "2026-06-08T00:00:00Z");
    expect(n).toBe(7);
    expect(c._captured.patch).toEqual(
      expect.objectContaining({ archived_reason: "not_in_werknl", status: "archived", archived_at: "2026-06-08T00:00:00Z" })
    );
    expect(c._captured.filters).toEqual(
      expect.arrayContaining([
        ["eq:source_id", "src-1"],
        ["lt:last_seen_in_sitemap", "2026-06-05T00:00:00Z"],
        ["is:archived_at", null],
      ])
    );
  });

  test("0 geraakt -> 0", async () => {
    const c = mockClient(0);
    const n = await archiveNotSeenSince(c as any, "src-1", "2026-06-05T00:00:00Z", "2026-06-08T00:00:00Z");
    expect(n).toBe(0);
  });
});
