/**
 * Veiligheidsnet-route: handmatige backfill voor werkenindekempen-scraper.
 *
 * Niet in vercel.json crons — alleen manual via POST.
 * Geen jitter, geen monitoring-wrapper (zou cron_job_logs vervuilen).
 *
 * Gebruik:
 *   curl -X POST https://lokale-banen-app.vercel.app/api/scrapers/werkenindekempen/backfill \
 *     -H 'Authorization: Bearer $CRON_SECRET' \
 *     -d '{"maxUrlsPerRun": 200}'
 */

import { NextRequest, NextResponse } from "next/server";
import { scrapeWerkenindekempen } from "@/lib/scrapers/werkenindekempen/scraper";
import { DEFAULT_CONFIG, type ScraperConfig } from "@/lib/scrapers/werkenindekempen/types";

export const runtime = "nodejs";
export const preferredRegion = ["fra1", "ams1"];
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? process.env.CRON_SECRET_KEY ?? ""}`;
  if (!auth || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const cfg: ScraperConfig = { ...DEFAULT_CONFIG, ...body, skipStartJitter: true };
  const startTime = Date.now();

  try {
    const stats = await scrapeWerkenindekempen(cfg);
    return NextResponse.json({
      success: stats.success,
      stats,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
