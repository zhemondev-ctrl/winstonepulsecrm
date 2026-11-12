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
