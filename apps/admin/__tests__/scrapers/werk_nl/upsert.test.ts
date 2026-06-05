import { describe, test, expect, vi } from "vitest";
import { upsertListing } from "@/lib/scrapers/werk_nl/upsert";
import type { SearchItem } from "@/lib/scrapers/werk_nl/types";

const item: SearchItem = { key: "k", referenceNumber: 123, vacatureTitle: "Test", workLocationCity: "UTRECHT" };

/** Mock supabase: lookup geeft `existing` terug, insert/update geregistreerd via spies. */
function mockClient(existing: { id: string } | null) {
  const insertSpy = vi.fn();
  const updateSpy = vi.fn();
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }),
      }),
      insert: (payload: Record<string, unknown>) => {
        insertSpy(payload);
        return Promise.resolve({ error: null });
      },
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          updateSpy(patch);
          return { error: null };
        },
      }),
    }),
    _spies: { insertSpy, updateSpy },
  };
  return client;
}

describe("upsertListing", () => {
  test("nieuw item -> insert", async () => {
    const client = mockClient(null);
    const r = await upsertListing(client as any, item, "src-1", "2026-06-05T10:00:00.000Z");
    expect(r).toBe("new");
    expect(client._spies.insertSpy).toHaveBeenCalledOnce();
    expect(client._spies.updateSpy).not.toHaveBeenCalled();
  });

  test("bestaand item -> alleen last_seen + needs_detail refresh, geen insert", async () => {
    const client = mockClient({ id: "jp-9" });
    const r = await upsertListing(client as any, item, "src-1", "2026-06-05T10:00:00.000Z");
    expect(r).toBe("seen");
    expect(client._spies.insertSpy).not.toHaveBeenCalled();
    expect(client._spies.updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ last_seen_in_sitemap: "2026-06-05T10:00:00.000Z" })
    );
  });
});
