import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/scrapers/werk_nl/detail-client", () => ({ fetchDetail: vi.fn() }));
vi.mock("@/lib/scrapers/werk_nl/dedup", () => ({ findOrCreateCompanyWerknl: vi.fn() }));
vi.mock("@/lib/scrapers/shared", () => ({ findOrCreateContact: vi.fn() }));
vi.mock("@/lib/scrapers/werk_nl/queue", () => ({ finalize: vi.fn() }));

import { parseWerknlDateAsUtc, processOne } from "@/lib/scrapers/werk_nl/process-one";
import { fetchDetail } from "@/lib/scrapers/werk_nl/detail-client";
import { findOrCreateCompanyWerknl } from "@/lib/scrapers/werk_nl/dedup";
import { findOrCreateContact } from "@/lib/scrapers/shared";
import { finalize } from "@/lib/scrapers/werk_nl/queue";
import type { WerknlSession } from "@/lib/scrapers/werk_nl/session";

const session = {} as WerknlSession;
const NOW = "2026-06-05T12:00:00.000Z";

function mockSupabase() {
  const updates: Array<Record<string, unknown>> = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { external_vacancy_id: "37544818" }, error: null }) }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          updates.push(patch);
          return { error: null };
        },
      }),
    }),
    _updates: updates,
  };
  return client;
}

function detailWith(expiration: string | null) {
  return {
    notFound: false as const,
    detail: {
      referenceNumber: 37544818,
      title: "Tester",
      description: "tekst",
      expirationDate: expiration,
      proposition: { workhours: { minimumHours: 36, maximumHours: 40 }, workLocation: { city: "UTRECHT" } },
      contactPerson: { name: "Dymph", email: "info@urgent.nl", phoneNumber: "030" },
      employer: { referenceNumber: 32609, organizationName: "Urgent Uitzendburo B.V.", website: "www.urgent.nl" },
      cvOffer: null,
    },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("processOne", () => {
  test("parseWerknlDateAsUtc behandelt naive datum als UTC", () => {
    expect(parseWerknlDateAsUtc("2026-07-03T00:00:00").toISOString()).toBe("2026-07-03T00:00:00.000Z");
    expect(parseWerknlDateAsUtc("2026-07-03T00:00:00+02:00").toISOString()).toBe("2026-07-02T22:00:00.000Z");
  });

  test("verrijkt: dedup + job_postings update + contact + finalize success", async () => {
    (fetchDetail as any).mockResolvedValue(detailWith("2026-12-31T00:00:00"));
    (findOrCreateCompanyWerknl as any).mockResolvedValue({ id: "comp-1", matchedLayer: "new" });
    (findOrCreateContact as any).mockResolvedValue({ id: "ct-1", created: true });
    const c = mockSupabase();

    const r = await processOne(c as any, session, "jp-1", NOW);
    expect(r).toBe("enriched");
    expect(findOrCreateCompanyWerknl).toHaveBeenCalledOnce();
    const patch = c._updates.at(-1)!;
    expect(patch).toEqual(expect.objectContaining({ company_id: "comp-1", detail_scraped_at: NOW, description: "tekst" }));
    expect(patch.expires_at).toBe("2026-12-31T00:00:00.000Z");
    expect(findOrCreateContact).toHaveBeenCalledOnce();
    expect(finalize).toHaveBeenCalledWith(c, "jp-1", expect.objectContaining({ status: "success" }));
  });

  test("404 -> archiveert (not_in_werknl), geen dedup", async () => {
    (fetchDetail as any).mockResolvedValue({ notFound: true });
    const c = mockSupabase();
    const r = await processOne(c as any, session, "jp-2", NOW);
    expect(r).toBe("archived_gone");
    expect(findOrCreateCompanyWerknl).not.toHaveBeenCalled();
    expect(c._updates.at(-1)).toEqual(expect.objectContaining({ archived_reason: "not_in_werknl", archived_at: NOW }));
    expect(finalize).toHaveBeenCalledWith(c, "jp-2", expect.objectContaining({ status: "success" }));
  });

  test("verstreken expirationDate -> archiveert (expired), geen dedup", async () => {
    (fetchDetail as any).mockResolvedValue(detailWith("2026-01-01T00:00:00"));
    const c = mockSupabase();
    const r = await processOne(c as any, session, "jp-3", NOW);
    expect(r).toBe("archived_expired");
    expect(findOrCreateCompanyWerknl).not.toHaveBeenCalled();
    expect(c._updates.at(-1)).toEqual(expect.objectContaining({ archived_reason: "expired" }));
  });
});
