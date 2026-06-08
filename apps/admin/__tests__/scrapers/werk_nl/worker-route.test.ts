import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/scrapers/shared", () => ({
  createSupabaseClient: vi.fn(() => ({ __client: true })),
  getOrCreateJobSource: vi.fn(),
  updateJobSourceStatus: vi.fn(),
}));

vi.mock("@/lib/scrapers/werk_nl/session", () => ({ bootstrapSession: vi.fn() }));
vi.mock("@/lib/scrapers/werk_nl/queue", () => ({
  claimBatch: vi.fn(),
  reapStaleProcessing: vi.fn(),
}));
vi.mock("@/lib/scrapers/werk_nl/process-one", () => ({ processOne: vi.fn() }));

import { POST } from "@/app/api/scrapers/werk-nl/worker/route";
import { getOrCreateJobSource, updateJobSourceStatus } from "@/lib/scrapers/shared";
import { bootstrapSession } from "@/lib/scrapers/werk_nl/session";
import { claimBatch, reapStaleProcessing } from "@/lib/scrapers/werk_nl/queue";
import { processOne } from "@/lib/scrapers/werk_nl/process-one";

describe("werk.nl worker route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T08:00:00.000Z"));
    process.env.CRON_SECRET_KEY = "test-secret";

    (getOrCreateJobSource as any).mockResolvedValue("source-uuid");
    (updateJobSourceStatus as any).mockResolvedValue(undefined);
    (bootstrapSession as any).mockResolvedValue({ token: "session" });
    (reapStaleProcessing as any).mockResolvedValue(0);
    (claimBatch as any)
      .mockResolvedValueOnce([{ jobPostingId: "jp-1", attempts: 1 }])
      .mockResolvedValueOnce([]);
    (processOne as any).mockResolvedValue("enriched");
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CRON_SECRET_KEY;
  });

  test("geeft de werk.nl source UUID door aan processOne", async () => {
    const req = new NextRequest("https://example.test/api/scrapers/werk-nl/worker", {
      method: "POST",
      headers: {
        authorization: "Bearer test-secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({ orchestrationId: "repair-orch", batchSize: 1, maxBatches: 1 }),
    });

    const pendingResponse = POST(req);
    await vi.advanceTimersByTimeAsync(5_000);
    const response = await pendingResponse;

    expect(response.status).toBe(200);
    expect(processOne).toHaveBeenCalledWith(
      { __client: true },
      { token: "session" },
      "jp-1",
      "2026-06-08T08:00:00.000Z",
      "source-uuid"
    );
  });
});
