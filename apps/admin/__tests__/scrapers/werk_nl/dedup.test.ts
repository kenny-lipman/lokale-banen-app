import { describe, test, expect } from "vitest";
import { findOrCreateCompanyWerknl } from "@/lib/scrapers/werk_nl/dedup";
import type { WerknlCompanyInput } from "@/lib/scrapers/werk_nl/detail-mapper";

const input: WerknlCompanyInput = {
  werknl_employer_id: "32609",
  name: "Urgent Uitzendburo B.V.",
  website: "www.urgent-uitzendburo.nl",
  match_domains: ["urgent-uitzendburo.nl"],
  city: "Utrecht",
  postal_code: "3572BB",
  street_address: "Biltstraat",
  is_bemiddelaar: true,
};

function mockClient(opts: {
  byEmployerId?: { id: string } | null;
  byEmployerIdSequence?: Array<{ id: string } | null>;
  byNormalized?: { id: string; werknl_employer_id: string | null } | null;
  byNameAddress?: { id: string; werknl_employer_id: string | null } | null;
  byHoofddomein?: { id: string; werknl_employer_id: string | null } | null;
  createdId?: string;
  insertError?: { code?: string; message: string };
}) {
  const updates: Array<Record<string, unknown>> = [];
  const inserts: Array<Record<string, unknown>> = [];
  const eqs: Array<{ col: string; value: unknown }> = [];
  const employerIdReads = [...(opts.byEmployerIdSequence ?? [])];
  const client = {
    from: () => ({
      select: () => ({
        eq: (col: string, value: unknown) => {
          const filters: Array<{ col: string; value: unknown }> = [{ col, value }];
          const query = {
            eq: (nextCol: string, nextValue: unknown) => {
              filters.push({ col: nextCol, value: nextValue });
              eqs.push({ col: nextCol, value: nextValue });
              return query;
            },
            maybeSingle: async () => {
              const cols = filters.map((filter) => filter.col);
              if (cols.includes("werknl_employer_id")) {
                if (employerIdReads.length > 0) return { data: employerIdReads.shift() ?? null };
                return { data: opts.byEmployerId ?? null };
              }
              if (cols.includes("hoofddomein")) return { data: opts.byHoofddomein ?? null };
              if (cols.includes("normalized_name") && cols.includes("postal_code") && cols.includes("street_address")) {
                return { data: opts.byNameAddress ?? null };
              }
              if (cols.includes("normalized_name")) return { data: opts.byNormalized ?? null };
              return { data: null };
            },
          };
          eqs.push({ col, value });
          return query;
        },
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
            if (opts.insertError) return { data: null, error: opts.insertError };
            return { data: { id: opts.createdId ?? "new-id" }, error: null };
          },
        }),
      }),
    }),
    _updates: updates,
    _inserts: inserts,
    _eqs: eqs,
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
    const r = await findOrCreateCompanyWerknl(c as any, { ...input, match_domains: [], postal_code: null, street_address: null }, "src");
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

  test("create-race op werknl_employer_id herleest en herstelt", async () => {
    const c = mockClient({
      byEmployerIdSequence: [null, { id: "c-race" }],
      insertError: { code: "23505", message: "duplicate key value violates unique constraint" },
    });
    const r = await findOrCreateCompanyWerknl(c as any, input, "src");
    expect(r).toEqual(
      expect.objectContaining({
        id: "c-race",
        matchedLayer: "werknl_employer_id",
        conflict: expect.stringContaining("Layer-4 create race"),
      })
    );
  });

  test("null werknl_employer_id slaat laag 1 over en matcht niet alleen op naam", async () => {
    const c = mockClient({
      byEmployerId: { id: "company-with-zero-id" },
      byNormalized: { id: "same-name-other-company", werknl_employer_id: null },
      createdId: "new-without-werknl-id",
    });

    const r = await findOrCreateCompanyWerknl(
      c as any,
      {
        ...input,
        werknl_employer_id: null,
        name: "Algemene Bedrijfsnaam B.V.",
        website: null,
        match_domains: [],
        postal_code: null,
        street_address: null,
      },
      "src"
    );

    expect(c._eqs).not.toContainEqual(expect.objectContaining({ col: "werknl_employer_id" }));
    expect(r).toEqual(expect.objectContaining({ id: "new-without-werknl-id", matchedLayer: "new" }));
    expect(c._inserts[0]).toEqual(
      expect.objectContaining({
        name: "Algemene Bedrijfsnaam B.V.",
        werknl_employer_id: null,
      })
    );
  });

  test("null werknl_employer_id kan matchen op naam en adres", async () => {
    const c = mockClient({ byNameAddress: { id: "c-address", werknl_employer_id: null } });

    const r = await findOrCreateCompanyWerknl(c as any, { ...input, werknl_employer_id: null, match_domains: [] }, "src");

    expect(r).toEqual(expect.objectContaining({ id: "c-address", matchedLayer: "name_address" }));
  });
});
