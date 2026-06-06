import { describe, test, expect } from "vitest";
import { enqueue, claimBatch, finalize, reapStaleProcessing } from "@/lib/scrapers/werk_nl/queue";

function mockClient(reapCount = 0) {
  const calls: { upserts: any[]; rpc?: any; update?: any; filters: Array<[string, unknown]> } = { upserts: [], filters: [] };
  const updateBuilder: any = {
    eq: (col: string, val: unknown) => {
      calls.filters.push([`eq:${col}`, val]);
      // finalize: update().eq() resolves; reaper: update().eq().lt() resolves.
      const res: any = Promise.resolve({ error: null });
      res.lt = (c: string, v: unknown) => {
        calls.filters.push([`lt:${c}`, v]);
        return Promise.resolve({ count: reapCount, error: null });
      };
      return res;
    },
  };
  const client = {
    from: () => ({
      upsert: (rows: unknown, opts: unknown) => {
        calls.upserts.push({ rows, opts });
        return Promise.resolve({ error: null });
      },
      update: (patch: Record<string, unknown>) => {
        calls.update = patch;
        return updateBuilder;
      },
    }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.rpc = { fn, args };
      return { data: [{ job_posting_id: "jp-1", attempts: 1 }], error: null };
    },
    _calls: calls,
  };
  return client;
}

describe("queue", () => {
  test("enqueue upsert met onConflict ignore, lege lijst doet niets", async () => {
    const c = mockClient();
    expect(await enqueue(c as any, [], "orch")).toBe(0);
    expect(c._calls.upserts).toHaveLength(0);
    const n = await enqueue(c as any, ["jp-1", "jp-2"], "orch-x");
    expect(n).toBe(2);
    expect(c._calls.upserts[0].rows[0]).toEqual(
      expect.objectContaining({ job_posting_id: "jp-1", orchestration_id: "orch-x", status: "pending" })
    );
  });

  test("enqueue chunkt grote batches", async () => {
    const c = mockClient();
    const ids = Array.from({ length: 1001 }, (_, i) => `jp-${i}`);
    const n = await enqueue(c as any, ids, "orch-x");
    expect(n).toBe(1001);
    expect(c._calls.upserts).toHaveLength(3);
    expect(c._calls.upserts.map((u: any) => u.rows.length)).toEqual([500, 500, 1]);
  });

  test("claimBatch met orchestrationId", async () => {
    const c = mockClient();
    const r = await claimBatch(c as any, "orch", 50);
    expect(c._calls.rpc.args).toEqual({ p_orchestration_id: "orch", p_batch_size: 50 });
    expect(r).toEqual([{ jobPostingId: "jp-1", attempts: 1 }]);
  });

  test("claimBatch met null orchestration (cron drain) geeft null door aan RPC", async () => {
    const c = mockClient();
    await claimBatch(c as any, null, 20);
    expect(c._calls.rpc.args).toEqual({ p_orchestration_id: null, p_batch_size: 20 });
  });

  test("finalize zet status + completed_at", async () => {
    const c = mockClient();
    await finalize(c as any, "jp-1", { status: "success" });
    expect(c._calls.update).toEqual(expect.objectContaining({ status: "success", completed_at: expect.any(String) }));
  });

  test("reapStaleProcessing reset vastgelopen processing-rijen en geeft aantal terug", async () => {
    const c = mockClient(3);
    const n = await reapStaleProcessing(c as any, 600_000);
    expect(n).toBe(3);
    expect(c._calls.update).toEqual(expect.objectContaining({ status: "pending", picked_at: null }));
    expect(c._calls.filters).toEqual(expect.arrayContaining([["eq:status", "processing"]]));
  });
});
