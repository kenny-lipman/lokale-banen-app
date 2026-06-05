import { describe, test, expect, vi } from "vitest";
import { findOrCreateCompanyWerknl } from "@/lib/scrapers/werk_nl/dedup";
import type { WerknlCompanyInput } from "@/lib/scrapers/werk_nl/detail-mapper";

const input: WerknlCompanyInput = {
  werknl_employer_id: "32609",
  name: "Urgent Uitzendburo B.V.",
  website: "www.urgent-uitzendburo.nl",
  city: "Utrecht",
  postal_code: "3572BB",
  street_address: "Biltstraat",
  is_bemiddelaar: true,
};

function mockClient(opts: {
  byEmployerId?: { id: string } | null;
  byNormalized?: { id: string; werknl_employer_id: string | null } | null;
  byHoofddomein?: { id: string; werknl_employer_id: string | null } | null;
  createdId?: string;
}) {
  const updates: Array<Record<string, unknown>> = [];
  const inserts: Array<Record<string, unknown>> = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: (col: string) => ({
          maybeSingle: async () => {
            if (col === "werknl_employer_id") return { data: opts.byEmployerId ?? null };
            if (col === "normalized_name") return { data: opts.byNormalized ?? null };
            if (col === "hoofddomein") return { data: opts.byHoofddomein ?? null };
            return { data: null };
          },
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          updates.push(patch);
          return { error: null };
        },
      }),
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            inserts.push(row);
            return { data: { id: opts.createdId ?? "new-id" }, error: null };
          },
        }),
      }),
    }),
    _updates: updates,
    _inserts: inserts,
  };
  return client;
}

describe("findOrCreateCompanyWerknl", () => {
  test("laag 1: werknl_employer_id hit, geen insert/update", async () => {
    const c = mockClient({ byEmployerId: { id: "c1" } });
    const r = await findOrCreateCompanyWerknl(c as any, input, "src");
    expect(r).toEqual(expect.objectContaining({ id: "c1", matchedLayer: "werknl_employer_id" }));
    expect(c._inserts).toHaveLength(0);
    expect(c._updates).toHaveLength(0);
  });

  test("laag 2: normalized_name hit + backfill werknl_employer_id", async () => {
    const c = mockClient({ byNormalized: { id: "c2", werknl_employer_id: null } });
    const r = await findOrCreateCompanyWerknl(c as any, input, "src");
    expect(r.matchedLayer).toBe("normalized_name");
    expect(c._inserts).toHaveLength(0);
    expect(c._updates[0]).toEqual(expect.objectContaining({ werknl_employer_id: "32609" }));
  });

  test("laag 3: hoofddomein hit", async () => {
    const c = mockClient({ byHoofddomein: { id: "c3", werknl_employer_id: null } });
    const r = await findOrCreateCompanyWerknl(c as any, input, "src");
    expect(r.matchedLayer).toBe("hoofddomein");
  });

  test("geen match -> create met is_bemiddelaar", async () => {
    const c = mockClient({ createdId: "c-new" });
    const r = await findOrCreateCompanyWerknl(c as any, input, "src");
    expect(r).toEqual(expect.objectContaining({ id: "c-new", matchedLayer: "new" }));
    expect(c._inserts[0]).toEqual(
      expect.objectContaining({ werknl_employer_id: "32609", is_bemiddelaar: true, name: "Urgent Uitzendburo B.V." })
    );
  });
});
