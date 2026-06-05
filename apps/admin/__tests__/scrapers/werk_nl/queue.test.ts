import { describe, test, expect, vi } from "vitest";
import { enqueue, claimBatch, finalize } from "@/lib/scrapers/werk_nl/queue";

function mockClient() {
  const calls: { upsert?: any; rpc?: any; update?: any } = {};
  const client = {
    from: () => ({
      upsert: (rows: unknown, opts: unknown) => {
        calls.upsert = { rows, opts };
        return Promise.resolve({ error: null });
      },
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          calls.update = patch;
          return { error: null };
        },
      }),
    }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.rpc = { fn, args };
      return {
        data: [
          { job_posting_id: "jp-1", attempts: 1 },
          { job_posting_id: "jp-2", attempts: 2 },
        ],
        error: null,
      };
    },
    _calls: calls,
  };
  return client;
}

describe("queue", () => {
  test("enqueue upsert met onConflict ignore, lege lijst doet niets", async () => {
    const c = mockClient();
    expect(await enqueue(c as any, [], "orch")).toBe(0);
    expect(c._calls.upsert).toBeUndefined();

    const n = await enqueue(c as any, ["jp-1", "jp-2"], "orch-x");
    expect(n).toBe(2);
    expect(c._calls.upsert.rows).toHaveLength(2);
    expect(c._calls.upsert.rows[0]).toEqual(
      expect.objectContaining({ job_posting_id: "jp-1", orchestration_id: "orch-x", status: "pending" })
    );
  });

  test("claimBatch roept de RPC en mapt naar camelCase", async () => {
    const c = mockClient();
    const r = await claimBatch(c as any, "orch", 50);
    expect(c._calls.rpc.fn).toBe("werknl_claim_batch");
    expect(c._calls.rpc.args).toEqual({ p_orchestration_id: "orch", p_batch_size: 50 });
    expect(r).toEqual([
      { jobPostingId: "jp-1", attempts: 1 },
      { jobPostingId: "jp-2", attempts: 2 },
    ]);
  });

  test("finalize zet status + completed_at", async () => {
    const c = mockClient();
    await finalize(c as any, "jp-1", { status: "success" });
    expect(c._calls.update).toEqual(
      expect.objectContaining({ status: "success", completed_at: expect.any(String) })
    );
  });
});
