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

import { closureCounts, compareDays, explainAssignment } from "@/lib/daily-audit";
import { computeAccountability } from "@/lib/accountability";

describe("incomplete reports in the 10% check", () => {
  const leads = (n: number, done: number) => Array.from({ length: n }, (_, i) => ({ id: `l${i}`, completed: i < done }));
  it("a report left unfinished on a completed lead adds one pending unit", () => {
    // 50 leads all done, 5 unfinished reports on other leads → 5 / 55 = 9.1% (within)
    const m = computeAccountability({ leads: leads(50, 50), dueFollowUps: [], missedReports: 5, incompleteReports: Array.from({ length: 5 }, (_, i) => ({ id: `r${i}`, leadId: `x${i}` })) });
    expect(m.eligible).toBe(55);
    expect(m.pending).toBe(5);
    expect(m.pendingPercent).toBe(9.1);
    expect(m.flagged).toBe(false);
  });
  it("6 unfinished reports on 50 done leads crosses 10%", () => {
    const m = computeAccountability({ leads: leads(50, 50), dueFollowUps: [], missedReports: 6, incompleteReports: Array.from({ length: 6 }, (_, i) => ({ id: `r${i}`, leadId: `x${i}` })) });
    expect(m.pendingPercent).toBe(10.7);
    expect(m.flagged).toBe(true);
  });
  it("an unfinished report on a lead already pending is not counted twice", () => {
    const m = computeAccountability({ leads: leads(50, 49), dueFollowUps: [], missedReports: 1, incompleteReports: [{ id: "r1", leadId: "l49" }] });
    expect(m.eligible).toBe(50);
    expect(m.pending).toBe(1);
    expect(m.incompleteReportsCounted).toBe(0);
  });
});

describe("five counters: closures", () => {
  it("separates answered closes, conversions and closes on unanswered calls", () => {
    const c = closureCounts([
      { lead_id: "a", category: "not_interested", connected: true },
      { lead_id: "b", category: "not_interested", connected: false },
      { lead_id: "c", category: "closed_converted", connected: true },
      { lead_id: "d", category: "no_answer", connected: false },
      { lead_id: "b", category: "wrong_number", connected: true },
    ]);
    expect(c).toEqual({ closedAnswered: 2, converted: 1, closedUnanswered: 0 });
  });
});

describe("why an agent received today's leads", () => {
  const cap = { enabled: true, limit: 50 };
  it("backlog 232 → 0 allowed", () => {
    expect(explainAssignment({ businessDay: true, paused: false, reviewLocked: false, backlog: 232, quota: 50, cap })).toEqual({ allowed: 0, reason: "backlog_full" });
  });
  it("backlog 39 → 11 allowed", () => {
    expect(explainAssignment({ businessDay: true, paused: false, reviewLocked: false, backlog: 39, quota: 50, cap })).toEqual({ allowed: 11, reason: "backlog_reduced" });
  });
  it("an unapproved HQ review blocks the day", () => {
    expect(explainAssignment({ businessDay: true, paused: false, reviewLocked: true, backlog: 0, quota: 50, cap })).toEqual({ allowed: 0, reason: "review_lock" });
  });
  it("no backlog → full 50", () => {
    expect(explainAssignment({ businessDay: true, paused: false, reviewLocked: false, backlog: 0, quota: 50, cap })).toEqual({ allowed: 50, reason: "full_quota" });
  });
});

describe("compare dates", () => {
  it("lists each day in the range", () => {
    expect(compareDays("2026-11-08", "2026-11-10", "2026-11-12")).toEqual(["2026-11-08", "2026-11-09", "2026-11-10"]);
  });
  it("caps the window at 7 days", () => {
    expect(compareDays("2026-11-01", "2026-11-12", "2026-11-12")).toHaveLength(7);
  });
  it("refuses a reversed range", () => {
    expect(compareDays("2026-11-10", "2026-11-08", "2026-11-12")).toEqual([]);
  });
});
