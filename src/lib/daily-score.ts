/**
 * Daily score from the saved C/R/A/V/F formula — pure, no I/O.
 * Each letter: points × min(1, count ÷ target). Counts come from rows the
 * server already scoped to one Dhaka day; self-collected lead work is dropped
 * unless the formula includes it. Recordings never affect the score.
 */
import type { CallEvidenceRow } from "@/lib/lead-verification";
import { isCallLogConfirmed } from "@/lib/call-log-confirmed";
import { dhakaDay } from "@/lib/lead-groups";
import { SCORE_LETTERS, type ScoreFormula, type ScoreMetric } from "@/lib/score-formula";

type Row = { id: string; agent_id: string | null; lead_id: string | null };
export type ScoreInput = {
  agents: { id: string; name: string | null }[];
  selfLeadIds: Set<string>;
  calls: (Row & CallEvidenceRow)[];
  reports: Row[];
  visits: Row[];
  /** Visits whose visit_at falls on the day, with status. */
  visitsHeld: (Row & { status: string | null })[];
  followUps: (Row & { scheduled_at: string | null; completed_at: string | null })[];
  bookings: Row[];
};

export function metricCounts(input: ScoreInput, agentId: string, includeSelf: boolean): Record<ScoreMetric, number> {
  const ok = (r: Row) => r.agent_id === agentId && (includeSelf || !r.lead_id || !input.selfLeadIds.has(r.lead_id));
  const calls = input.calls.filter(ok);
  const reports = input.reports.filter(ok);
  return {
    call_attempts: calls.length,
    connected_calls: calls.filter((c) => isCallLogConfirmed(c)).length,
    reports_submitted: reports.length,
    company_leads_worked: new Set(reports.filter((r) => r.lead_id && !input.selfLeadIds.has(r.lead_id)).map((r) => r.lead_id)).size,
    site_visits: input.visits.filter(ok).length,
    appointments_set: input.visits.filter(ok).length,
    visits_completed: input.visitsHeld.filter(ok).filter((v) => v.status === "completed").length,
    follow_ups_on_time: input.followUps.filter(ok).filter((f) => f.scheduled_at && f.completed_at && dhakaDay(f.completed_at) <= dhakaDay(f.scheduled_at)).length,
    bookings_approved: input.bookings.filter(ok).length,
  };
}

export function scoreLetters(formula: ScoreFormula, counts: Record<ScoreMetric, number>) {
  const parts = SCORE_LETTERS.map((l) => {
    const { metric, points, target, label } = formula.letters[l];
    const count = counts[metric] ?? 0;
    const earned = Math.round(points * Math.min(1, count / target) * 10) / 10;
    return { letter: l, label, metric, count, target, points, earned };
  });
  return { parts, total: Math.round(parts.reduce((n, p) => n + p.earned, 0) * 10) / 10 };
}

export function dailyScores(formula: ScoreFormula, input: ScoreInput) {
  return input.agents
    .map((a) => ({ agentId: a.id, name: a.name ?? "Agent", ...scoreLetters(formula, metricCounts(input, a.id, formula.includeSelfLeads)) }))
    .sort((x, y) => y.total - x.total || x.name.localeCompare(y.name));
}

/**
 * Policy score (owner-approved 14 Nov 2026, replaces the 100-point formula):
 * Score = 2C + 2R + A + 4V + 1.5F, uncapped.
 * C leads worked to a final outcome, R submitted call reports, A call attempts,
 * V call-log-confirmed connected calls, F completed follow-ups. Company and
 * self-collected work both count; each persisted row counts once.
 */
export const POLICY_WEIGHTS = { C: 2, R: 2, A: 1, V: 4, F: 1.5 } as const;
export const POLICY_LABELS = {
  C: "Leads worked to a final outcome", R: "Call reports submitted", A: "Call attempts",
  V: "Phone-log verified connected calls", F: "Follow-ups completed",
} as const;

export function policyCounts(input: ScoreInput, agentId: string, finalLeadIds: Set<string>) {
  const mine = <T extends Row>(rows: T[]) => { const seen = new Set<string>(); return rows.filter((r) => r.agent_id === agentId && !seen.has(r.id) && (seen.add(r.id), true)); };
  const reports = mine(input.reports);
  const calls = mine(input.calls);
  return {
    C: new Set(reports.filter((r) => r.lead_id && finalLeadIds.has(r.lead_id)).map((r) => r.lead_id)).size,
    R: reports.length,
    A: calls.length,
    V: calls.filter((c) => isCallLogConfirmed(c)).length,
    F: mine(input.followUps).filter((f) => f.completed_at).length,
  };
}

export function policyScores(input: ScoreInput, finalLeadIds: Set<string>) {
  return input.agents.map((a) => {
    const c = policyCounts(input, a.id, finalLeadIds);
    const parts = SCORE_LETTERS.map((l) => ({ letter: l, label: POLICY_LABELS[l], metric: l, count: c[l], target: POLICY_WEIGHTS[l], points: POLICY_WEIGHTS[l], earned: Math.round(c[l] * POLICY_WEIGHTS[l] * 10) / 10 }));
    return { agentId: a.id, name: a.name ?? "Agent", parts, total: Math.round(parts.reduce((n, p) => n + p.earned, 0) * 10) / 10 };
  }).sort((x, y) => y.total - x.total || x.name.localeCompare(y.name));
}
