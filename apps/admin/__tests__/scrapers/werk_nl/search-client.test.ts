import { describe, test, expect, vi, afterEach } from "vitest";
import { searchPage } from "@/lib/scrapers/werk_nl/search-client";
import type { WerknlSession } from "@/lib/scrapers/werk_nl/session";

afterEach(() => vi.restoreAllMocks());

const session: WerknlSession = { jar: new Map(), xsrfToken: "t", userAgent: "UA" };

function mockFetchOnce(jsonBody: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      status,
      ok: status >= 200 && status < 300,
      headers: { getSetCookie: () => [] as string[] },
      text: async () => JSON.stringify(jsonBody),
    }))
  );
}

describe("searchPage", () => {
  test("parset items en totalResults", async () => {
    mockFetchOnce({
      totalResults: 285291,
      items: [
        { key: "2001:L:1", referenceNumber: 1, vacatureTitle: "Tester", organisation: "ACME", workLocationCity: "UTRECHT" },
      ],
    });
    const res = await searchPage(session, 1);
    expect(res.total).toBe(285291);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].referenceNumber).toBe(1);
  });

  test("gooit bij HTTP 500", async () => {
    mockFetchOnce({}, 500);
    await expect(searchPage(session, 1)).rejects.toThrow(/HTTP 500/);
  });

  test("ongeldige items worden overgeslagen, geldige behouden", async () => {
    mockFetchOnce({
      totalResults: 2,
      items: [
        { key: "k", referenceNumber: 5, vacatureTitle: "OK" },
        { referenceNumber: "geen-getal" }, // invalid: geen key, ref is string
      ],
    });
    const res = await searchPage(session, 1);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].referenceNumber).toBe(5);
  });
});
