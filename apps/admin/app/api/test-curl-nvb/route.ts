/**
 * TEST ENDPOINT — compare different HTTP client fingerprints against NVB API
 * Tells us whether the 403 is IP-based or TLS/fingerprint-based
 */

import { NextResponse } from "next/server";
import { execSync } from "node:child_process";
import * as https from "node:https";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NVB_URL =
  "https://api.nationalevacaturebank.nl/api/jobs/v3/sites/nationalevacaturebank.nl/jobs?page=1&limit=1&sort=date";

const HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Referer: "https://www.nationalevacaturebank.nl/",
  Origin: "https://www.nationalevacaturebank.nl",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
};

async function testNativeFetch(): Promise<{ status: number | null; bytes: number; error?: string }> {
  try {
    const res = await fetch(NVB_URL, { headers: HEADERS });
    const body = await res.text();
    return { status: res.status, bytes: body.length };
  } catch (err) {
    return { status: null, bytes: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

async function testHttpsModule(): Promise<{ status: number | null; bytes: number; error?: string }> {
  return new Promise((resolve) => {
    const req = https.get(NVB_URL, { headers: HEADERS }, (res) => {
      let bytes = 0;
      res.on("data", (chunk) => {
        bytes += chunk.length;
      });
      res.on("end", () => resolve({ status: res.statusCode ?? null, bytes }));
    });
    req.on("error", (err) => resolve({ status: null, bytes: 0, error: err.message }));
    req.setTimeout(15_000, () => {
      req.destroy();
      resolve({ status: null, bytes: 0, error: "timeout" });
    });
  });
}

function testCurl(): { status: number | null; bytes: number; error?: string; version?: string } {
  try {
    const version = execSync("curl --version", { encoding: "utf-8", timeout: 5000 })
      .split("\n")[0]
      .trim();

    const headerArgs = Object.entries(HEADERS)
      .map(([k, v]) => `-H '${k}: ${v.replace(/'/g, "'\\''")}'`)
      .join(" ");

    const cmd = `curl -s -o /tmp/nvb-response.json -w '%{http_code}' --max-time 15 ${headerArgs} '${NVB_URL}'`;
    const statusStr = execSync(cmd, { encoding: "utf-8", timeout: 20_000 }).trim();
    const status = Number.parseInt(statusStr, 10);
    const bytes = Number.parseInt(
      execSync("wc -c < /tmp/nvb-response.json", { encoding: "utf-8" }).trim(),
      10
    );

    return { status, bytes, version };
  } catch (err) {
    return { status: null, bytes: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

async function getOutboundIp(): Promise<string> {
  try {
    const res = await fetch("https://api.ipify.org");
    return await res.text();
  } catch {
    return "unknown";
  }
}

export async function GET() {
  const ip = await getOutboundIp();

  const [fetchResult, httpsResult] = await Promise.all([testNativeFetch(), testHttpsModule()]);
  const curlResult = testCurl();

  return NextResponse.json({
    outboundIp: ip,
    tests: {
      "native fetch (undici)": fetchResult,
      "node https module": httpsResult,
      "curl (shell-out)": curlResult,
    },
    timestamp: new Date().toISOString(),
  });
}
