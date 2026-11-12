import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ scope: null as string | null, writes: 0 }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (validate: (v: unknown) => unknown) => ({
      handler: (fn: (v: unknown) => unknown) => (args: { data: unknown }) => fn({ data: validate(args.data) }),
    }),
  }),
}));
vi.mock("@/lib/admin-gate.server", () => ({ adminTokenScope: () => state.scope }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: () => { const q: Record<string, unknown> = {}; for (const k of ["select", "eq", "insert"]) q[k] = () => { if (k === "insert") state.writes++; return q; }; q.maybeSingle = async () => ({ data: null, error: null }); return q; } },
}));

import { cappedQuota, DEFAULT_BACKLOG_CAP, isAutoDistributionPaused, readBacklogCap } from "@/lib/backlog-cap";
import { demeritTotals } from "@/lib/demerits";
import { cancelAgentDemerit } from "@/lib/demerits.functions";
import { agentEnteredVisit } from "@/lib/site-visit-lock";

describe("Net 50 backlog cap", () => {
  it("is on at 50 by default", () => {
    expect(readBacklogCap(null)).toEqual({ enabled: true, limit: 50 });
  });
  it("new leads = 50 − older backlog", () => {
    expect(cappedQuota(50, 35, DEFAULT_BACKLOG_CAP)).toBe(15);
  });
  it("a backlog of 50 or more gets no new leads", () => {
    expect(cappedQuota(50, 50, DEFAULT_BACKLOG_CAP)).toBe(0);
    expect(cappedQuota(50, 232, DEFAULT_BACKLOG_CAP)).toBe(0);
  });
  it("never gives more than the normal daily quota", () => {
    expect(cappedQuota(50, 0, DEFAULT_BACKLOG_CAP)).toBe(50);
    expect(cappedQuota(20, 4, DEFAULT_BACKLOG_CAP)).toBe(20);
  });
  it("can be switched off by setting", () => {
    expect(cappedQuota(50, 232, readBacklogCap({ enabled: false }))).toBe(50);
  });
});

describe("3-day clearance pause", () => {
  it("Saturday 14 Nov 2026 has no morning auto-distribution by default", () => {
    expect(isAutoDistributionPaused("2026-11-14", null)).toBe(true);
  });
  it("Sunday 15 Nov 2026 distributes normally", () => {
    expect(isAutoDistributionPaused("2026-11-15", null)).toBe(false);
  });
  it("a saved setting replaces the default days", () => {
    expect(isAutoDistributionPaused("2026-11-14", { days: [] })).toBe(false);
  });
});

describe("demerit log", () => {
  it("each system block is one point; cancelled points are counted separately", () => {
    const t = demeritTotals([
      { reviewId: "1", agentId: "a", businessDate: "2026-11-10", pendingPercent: 55, status: "review_required", cancelled: null },
      { reviewId: "2", agentId: "a", businessDate: "2026-11-11", pendingPercent: 44, status: "approved", cancelled: { reason: "system fault", at: "x" } },
    ]);
    expect(t.get("a")).toEqual({ points: 1, cancelled: 1 });
  });
  it.each(["full", "leadhub", null])("only HQ cancels a point (refuses %s before writing)", async (scope) => {
    state.scope = scope; state.writes = 0;
    await expect((cancelAgentDemerit as unknown as (a: { data: unknown }) => Promise<unknown>)({ data: { adminToken: "t", reviewId: "00000000-0000-4000-8000-000000000001", reason: "system fault" } })).rejects.toThrow("Only Executive HQ");
    expect(state.writes).toBe(0);
  });
});

describe("site-visit edit lock", () => {
  const me = { id: "agent-1", name: "Monisha Biswas" };
  it("the agent who entered a visit may change it", () => {
    expect(agentEnteredVisit({ agent_id: "agent-1", created_by: "Monisha Biswas", created_by_profile_id: "agent-1" }, me)).toBe(true);
  });
  it("a visit IT entered on the agent's lead is locked for the agent", () => {
    expect(agentEnteredVisit({ agent_id: "agent-1", created_by: "IT Console", created_by_profile_id: null }, me)).toBe(false);
  });
  it("another agent's visit is locked", () => {
    expect(agentEnteredVisit({ agent_id: "agent-2", created_by: "Monisha Biswas", created_by_profile_id: "agent-2" }, me)).toBe(false);
  });
  it("older visits fall back to the saved entry name", () => {
    expect(agentEnteredVisit({ agent_id: "agent-1", created_by: "Monisha Biswas", created_by_profile_id: null }, me)).toBe(true);
  });
});
