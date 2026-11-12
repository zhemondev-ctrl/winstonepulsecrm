import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ callerScope: "authority", reads: 0 }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (validate: (v: unknown) => unknown) => ({
      handler: (fn: (v: unknown) => unknown) => (args: { data: unknown }) => fn({ data: validate(args.data) }),
    }),
  }),
}));
vi.mock("@/lib/access.server", () => ({ resolveCaller: async () => ({ scope: state.callerScope }) }));
vi.mock("@/lib/lead-pool.server", () => ({ activeAgents: async () => { state.reads++; return []; } }));

import { auditableDay, teamTotals, type AuditRow } from "@/lib/daily-audit";
import { getDailyAgentAudit } from "@/lib/daily-audit.functions";

const audit = getDailyAgentAudit as unknown as (a: { data: unknown }) => Promise<unknown>;
const row = (o: Partial<AuditRow>): AuditRow => ({ assigned: 0, completed: 0, eligible: 0, pending: 0, pendingPercent: 0, overdueFollowUps: 0, dueFollowUps: 0, missedReports: 0, callsLogged: 0, reportsSubmitted: 0, flagged: false, ...o });

describe("daily audit rules", () => {
  it("allows days from the rule start (28 Sep 2026) up to today", () => {
    expect(auditableDay("2026-09-28", "2026-11-12")).toBe(true);
    expect(auditableDay("2026-11-12", "2026-11-12")).toBe(true);
  });
  it("refuses days before the rule started", () => {
    expect(auditableDay("2026-09-27", "2026-11-12")).toBe(false);
  });
  it("refuses future days", () => {
    expect(auditableDay("2026-11-13", "2026-11-12")).toBe(false);
  });
  it("team pending % uses summed work, not an average of agent percentages", () => {
    // Agent A: 5 of 50 pending (10%), Agent B: 5 of 10 pending (50%) → team 10 of 60 = 16.7%
    const t = teamTotals([row({ eligible: 50, pending: 5, pendingPercent: 10 }), row({ eligible: 10, pending: 5, pendingPercent: 50, flagged: true })]);
    expect(t.pendingPercent).toBe(16.7);
    expect(t.overThreshold).toBe(1);
  });
  it("an empty day is 0% pending", () => {
    expect(teamTotals([]).pendingPercent).toBe(0);
  });
});

describe("daily audit access", () => {
  it("agents cannot read the audit", async () => {
    state.callerScope = "agent"; state.reads = 0;
    await expect(audit({ data: { adminToken: null, day: "2026-11-11" } })).rejects.toThrow("Executive HQ or IT access required");
    expect(state.reads).toBe(0);
    state.callerScope = "authority";
  });
  it("future days are refused before reading any records", async () => {
    state.reads = 0;
    await expect(audit({ data: { adminToken: "t", day: "2099-01-01" } })).rejects.toThrow("Choose a day");
    expect(state.reads).toBe(0);
  });
});
