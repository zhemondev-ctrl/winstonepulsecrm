import { describe, expect, it } from "vitest";
import { dailyScores } from "@/lib/daily-score";
import type { ScoreFormula } from "@/lib/score-formula";

const f = (includeSelfLeads: boolean): ScoreFormula => ({ includeSelfLeads, letters: {
  C: { label: "C", metric: "connected_calls", points: 30, target: 10 },
  R: { label: "R", metric: "reports_submitted", points: 20, target: 4 },
  A: { label: "A", metric: "call_attempts", points: 20, target: 2 },
  V: { label: "V", metric: "site_visits", points: 15, target: 1 },
  F: { label: "F", metric: "follow_ups_on_time", points: 15, target: 1 },
} });
const input = {
  agents: [{ id: "a", name: "A" }], selfLeadIds: new Set(["self"]), calls: [], visits: [], visitsHeld: [], followUps: [], bookings: [],
  reports: [{ id: "1", agent_id: "a", lead_id: "co" }, { id: "2", agent_id: "a", lead_id: "self" }],
};
describe("daily score", () => {
  it("a newly entered lead with no saved work evidence earns zero in every letter", () => {
    const result = dailyScores(f(true), { ...input, reports: [] })[0];
    expect(result?.total).toBe(0); expect(result?.parts.map(p => p.count)).toEqual([0,0,0,0,0]);
  });
  it("earns a share of points below target", () => expect(dailyScores(f(false), input)[0].parts[1].earned).toBe(5));
  it("self-lead work counts only when included", () => expect(dailyScores(f(true), input)[0].parts[1].earned).toBe(10));
  it("caps a letter at its points", () => expect(dailyScores(f(true), { ...input, visits: [1, 2, 3].map((i) => ({ id: String(i), agent_id: "a", lead_id: "co" })) })[0].parts[3].earned).toBe(15));
});

it("only completed visits count as visits completed", () => {
  const g = { ...f(true), letters: { ...f(true).letters, V: { label: "V", metric: "visits_completed" as const, points: 15, target: 1 } } };
  expect(dailyScores(g, { ...input, visitsHeld: [{ id: "v", agent_id: "a", lead_id: "co", status: "no_show" }] })[0].parts[3].earned).toBe(0);
});

import { policyScores } from "@/lib/daily-score";
describe("policy score 2C + 2R + A + 4V + 1.5F", () => {
  it("weights each letter and counts each row once", () => {
    const base = { agents: [{ id: "a", name: "A" }], selfLeadIds: new Set<string>(), visits: [], visitsHeld: [], bookings: [] };
    const call = (id: string, ok: boolean) => ({ id, agent_id: "a", lead_id: "L1", call_status: "completed", duration_seconds: ok ? 30 : 0, call_source: "android_sim", external_call_id: id, talk_time_source: ok ? "call_log" : null });
    const [r] = policyScores({ ...base,
      calls: [call("c1", true), call("c2", false), call("c1", true)] as never,
      reports: [{ id: "r1", agent_id: "a", lead_id: "L1" }, { id: "r2", agent_id: "a", lead_id: "L2" }],
      followUps: [{ id: "f1", agent_id: "a", lead_id: "L1", scheduled_at: null, completed_at: "2026-11-14T05:00:00Z" }],
    }, new Set(["L1"]));
    // C=1 (L1 final), R=2, A=2, V=1, F=1 → 2+4+2+4+1.5
    expect(r.total).toBe(13.5);
  });
});
