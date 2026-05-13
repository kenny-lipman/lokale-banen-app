/**
 * Dedup unit tests met gemockte Supabase-client.
 *
 * 4 scenarios:
 *   1. Layer 1 hit (werkenindekempen_id match)
 *   2. Layer 2 hit (normalized_name match) + backfill
 *   3. Layer 3 hit (hoofddomein match) + backfill
 *   4. No match → create new
 */

import { describe, test, expect, vi } from "vitest";
import { findOrCreateCompanyThreeLayer } from "@/lib/scrapers/werkenindekempen/dedup";

interface MockRow {
  id?: string;
  werkenindekempen_id?: string | null;
  normalized_name?: string;
  hoofddomein?: string;
}

interface QueryState {
  eqs: Record<string, unknown>;
}

/**
 * Mock Supabase client met scenario-based lookup-responses.
 *
 * scenario.lookups: array van rows die maybeSingle() kan returnen,
 * geïndexeerd op {column, value} match.
 */
function mockClient(opts: {
  /** Per .eq()-filter → row die maybeSingle returnt (of null) */
  lookups: Array<{ column: string; value: string; row: MockRow | null }>;
  /** Returnt deze id bij insert() */
  insertReturnsId?: string;
  /** Throw bij update() */
  updateError?: string | null;
}) {
  const insertSpy = vi.fn();
  const updateSpy = vi.fn();

  const client = {
    from: () => ({
      select: () => ({
        eq: (col1: string, val1: string) => ({
          eq: (_col2: string, _val2: string) => ({
            maybeSingle: async () => {
              // For 2-eq chains (not used here, but defined for completeness)
              const hit = opts.lookups.find(
                (l) => l.column === col1 && l.value === val1
              );
              return { data: hit?.row ?? null, error: null };
            },
          }),
          maybeSingle: async () => {
            const hit = opts.lookups.find(
              (l) => l.column === col1 && l.value === val1
            );
            return { data: hit?.row ?? null, error: null };
          },
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async (_col: string, _val: string) => {
          updateSpy(patch);
          return { error: opts.updateError ? { message: opts.updateError } : null };
        },
      }),
      insert: (payload: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            insertSpy(payload);
            return {
              data: { id: opts.insertReturnsId ?? "new-uuid" },
              error: null,
            };
          },
        }),
      }),
    }),
    _spies: { insertSpy, updateSpy },
  };
  return client;
}

const INPUT = {
  werkenindekempen_id: "c1913",
  name: "AAE B.V.",
  website: "https://www.aaebv.com",
  logo_url: "https://logo.png",
  city: "Helmond",
  state: "Noord-Brabant",
  country: "Netherlands",
  street_address: null,
  postal_code: null,
  location: "Helmond",
};

describe("findOrCreateCompanyThreeLayer", () => {
  test("Layer 1: werkenindekempen_id hit", async () => {
    const client = mockClient({
      lookups: [{ column: "werkenindekempen_id", value: "c1913", row: { id: "company-1" } }],
    });
    const result = await findOrCreateCompanyThreeLayer(client as any, INPUT, "source-1");
    expect(result.matchedLayer).toBe("werkenindekempen_id");
    expect(result.id).toBe("company-1");
    expect(client._spies.updateSpy).not.toHaveBeenCalled();
    expect(client._spies.insertSpy).not.toHaveBeenCalled();
  });

  test("Layer 2: normalized_name hit + backfill werkenindekempen_id", async () => {
    const client = mockClient({
      lookups: [
        // werkenindekempen_id miss
        { column: "werkenindekempen_id", value: "c1913", row: null },
        // normalized_name = "aae bv" (van "AAE B.V." door generateNormalizedName)
        { column: "normalized_name", value: "aae bv", row: { id: "company-2", werkenindekempen_id: null } },
      ],
    });
    const result = await findOrCreateCompanyThreeLayer(client as any, INPUT, "source-1");
    expect(result.matchedLayer).toBe("normalized_name");
    expect(result.id).toBe("company-2");
    expect(result.conflict).toBeUndefined();
    expect(client._spies.updateSpy).toHaveBeenCalledWith({ werkenindekempen_id: "c1913" });
    expect(client._spies.insertSpy).not.toHaveBeenCalled();
  });

  test("Layer 3: hoofddomein hit + backfill", async () => {
    const client = mockClient({
      lookups: [
        { column: "werkenindekempen_id", value: "c1913", row: null },
        { column: "normalized_name", value: "aae bv", row: null },
        { column: "hoofddomein", value: "aaebv.com", row: { id: "company-3", werkenindekempen_id: null } },
      ],
    });
    const result = await findOrCreateCompanyThreeLayer(client as any, INPUT, "source-1");
    expect(result.matchedLayer).toBe("hoofddomein");
    expect(result.id).toBe("company-3");
    expect(client._spies.updateSpy).toHaveBeenCalledWith({ werkenindekempen_id: "c1913" });
  });

  test("Layer 4: no match → create new", async () => {
    const client = mockClient({
      lookups: [
        { column: "werkenindekempen_id", value: "c1913", row: null },
        { column: "normalized_name", value: "aae bv", row: null },
        { column: "hoofddomein", value: "aaebv.com", row: null },
      ],
      insertReturnsId: "fresh-uuid",
    });
    const result = await findOrCreateCompanyThreeLayer(client as any, INPUT, "source-1");
    expect(result.matchedLayer).toBe("new");
    expect(result.id).toBe("fresh-uuid");
    expect(client._spies.insertSpy).toHaveBeenCalledOnce();
    const payload = (client._spies.insertSpy.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
    expect(payload.name).toBe("AAE B.V.");
    expect(payload.werkenindekempen_id).toBe("c1913");
    expect(payload.normalized_name).toBe("aae bv");
    expect(payload.hoofddomein).toBe("aaebv.com");
    expect(payload.source).toBe("source-1");
    expect(payload.status).toBe("Prospect");
  });

  test("Layer 2: backfill conflict → conflict field gezet, geen throw", async () => {
    const client = mockClient({
      lookups: [
        { column: "werkenindekempen_id", value: "c1913", row: null },
        { column: "normalized_name", value: "aae bv", row: { id: "company-2", werkenindekempen_id: null } },
      ],
      updateError: "duplicate key violates unique constraint",
    });
    const result = await findOrCreateCompanyThreeLayer(client as any, INPUT, "source-1");
    expect(result.matchedLayer).toBe("normalized_name");
    expect(result.conflict).toContain("Layer-2 backfill");
  });
});
