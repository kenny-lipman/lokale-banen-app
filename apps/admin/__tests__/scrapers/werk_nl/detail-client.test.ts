import { describe, test, expect, vi, afterEach } from "vitest";
import { fetchDetail } from "@/lib/scrapers/werk_nl/detail-client";
import type { WerknlSession } from "@/lib/scrapers/werk_nl/session";

afterEach(() => vi.restoreAllMocks());

const session: WerknlSession = { jar: new Map(), xsrfToken: "t", userAgent: "UA" };

function mockFetchOnce(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      status,
      ok: status >= 200 && status < 300,
      headers: { getSetCookie: () => [] as string[] },
      text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    }))
  );
}

const realPayload = {
  referenceNumber: 37544818,
  title: "Technisch handige medewerker",
  expirationDate: "2026-07-03T00:00:00",
  modifiedDate: "2026-06-05T00:00:00",
  description: "Lange tekst",
  isAcquisitionNotAppreciated: true,
  proposition: {
    function: { name: "Assemblagemedewerker", description: "eisen", customDescription: "Technisch" },
    salary: { type: 1, amountIndication: "2500 - 3500" },
    workhours: { minimumHours: 36, maximumHours: 40 },
    workLocation: { type: 2, city: "UTRECHT", postcode: "3572BB" },
    contract: { type: 1 },
  },
  contactPerson: { referenceNumber: 32609, name: "Dymph Herber", email: "info@urgent.nl", phoneNumber: "030-2316344", department: null },
  employer: { referenceNumber: 32609, organizationName: "Urgent Uitzendburo B.V.", website: "www.urgent-uitzendburo.nl", sector: "31317" },
  cvOffer: { educationLevel: { name: "Vmbo" } },
};

describe("fetchDetail", () => {
  test("parset een echte payload", async () => {
    mockFetchOnce(realPayload);
    const r = await fetchDetail(session, 37544818);
    expect(r.notFound).toBe(false);
    if (r.notFound) return;
    expect(r.detail.referenceNumber).toBe(37544818);
    expect(r.detail.expirationDate).toBe("2026-07-03T00:00:00");
    expect(r.detail.employer?.organizationName).toBe("Urgent Uitzendburo B.V.");
    expect(r.detail.proposition?.workhours?.minimumHours).toBe(36);
  });

  test("404 -> notFound (geen throw, zodat de worker kan archiveren)", async () => {
    mockFetchOnce("", 404);
    const r = await fetchDetail(session, 999);
    expect(r.notFound).toBe(true);
  });

  test("gooit bij HTTP 500", async () => {
    mockFetchOnce("", 500);
    await expect(fetchDetail(session, 1)).rejects.toThrow(/HTTP 500/);
  });

  test("tolereert ontbrekende optionele velden", async () => {
    mockFetchOnce({ referenceNumber: 5, title: "Kaal" });
    const r = await fetchDetail(session, 5);
    expect(r.notFound).toBe(false);
    if (r.notFound) return;
    expect(r.detail.contactPerson).toBeNull();
    expect(r.detail.employer).toBeNull();
  });
});
