import { describe, test, expect, vi, afterEach } from "vitest";
import { parseCookies, cookieHeader, type WerknlSession } from "@/lib/scrapers/werk_nl/session";

afterEach(() => vi.restoreAllMocks());

describe("parseCookies", () => {
  test("extraheert naam=waarde uit Set-Cookie strings", () => {
    const jar = new Map<string, string>();
    parseCookies(jar, [
      "OAMAuthnCookie_www.werk.nl:443=abc123; path=/; secure; httponly",
      "XSRF-TOKEN=tok789; path=/; samesite=strict",
    ]);
    expect(jar.get("OAMAuthnCookie_www.werk.nl:443")).toBe("abc123");
    expect(jar.get("XSRF-TOKEN")).toBe("tok789");
  });

  test("expired cookie (max-age=0 / verleden) wordt genegeerd of overschreven", () => {
    const jar = new Map<string, string>([["X", "old"]]);
    parseCookies(jar, ["X=new; path=/"]);
    expect(jar.get("X")).toBe("new");
  });
});

describe("cookieHeader", () => {
  test("bouwt 'k=v; k2=v2' string uit de jar", () => {
    const jar = new Map([["A", "1"], ["B", "2"]]);
    expect(cookieHeader(jar)).toBe("A=1; B=2");
  });
});
