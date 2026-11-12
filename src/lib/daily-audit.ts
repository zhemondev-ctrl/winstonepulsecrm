/** Pure rules for the daily agent audit (read-only view of the 10% accountability measure). */
import { ACCOUNTABILITY_START_DATE, PENDING_THRESHOLD_PERCENT } from "@/lib/accountability";

export { PENDING_THRESHOLD_PERCENT };

/** A day may be audited from the rule's start date up to today in Dhaka. */
export function auditableDay(day: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== day) return false;
  return day >= ACCOUNTABILITY_START_DATE && day <= today;
}

export type AuditRow = {
  assigned: number;
  completed: number;
  eligible: number;
  pending: number;
  pendingPercent: number;
  overdueFollowUps: number;
  dueFollowUps: number;
  missedReports: number;
  callsLogged: number;
  reportsSubmitted: number;
  flagged: boolean;
};

/** Team totals use summed counts, never an average of agent percentages. */
export function teamTotals(rows: AuditRow[]) {
  const sum = (k: keyof AuditRow) => rows.reduce((n, r) => n + Number(r[k] as number), 0);
  const eligible = sum("eligible");
  const pending = sum("pending");
  return {
    agents: rows.length,
    overThreshold: rows.filter((r) => r.flagged).length,
    assigned: sum("assigned"),
    completed: sum("completed"),
    eligible,
    pending,
    pendingPercent: eligible === 0 ? 0 : Math.round((pending / eligible) * 1000) / 10,
    dueFollowUps: sum("dueFollowUps"),
    overdueFollowUps: sum("overdueFollowUps"),
    missedReports: sum("missedReports"),
    callsLogged: sum("callsLogged"),
    reportsSubmitted: sum("reportsSubmitted"),
  };
}

/** Company leads per desk per Dhaka day (hard cap). */
export { MAX_DAILY_LEADS_PER_AGENT as DAILY_COMPANY_QUOTA } from "@/lib/lead-quota";

/** Report categories that close a lead. */
export const CLOSING_CATEGORIES = ["not_interested", "wrong_number", "closed_converted", "fake"] as const;

export type ClosureReport = { lead_id: string | null; category: string | null; connected: boolean | null };

/**
 * Genuine closed = closed after a call the agent marked as answered; converted is
 * counted on its own; a close on an unanswered call is shown separately so it can
 * be reviewed. Each lead counts once; any answered close makes it genuine.
 */
export function closureCounts(reports: ClosureReport[]) {
  const answered = new Set<string>();
  const converted = new Set<string>();
  const unanswered = new Set<string>();
  for (const r of reports) {
    if (!r.lead_id || !r.category || !(CLOSING_CATEGORIES as readonly string[]).includes(r.category)) continue;
    if (r.category === "closed_converted") converted.add(r.lead_id);
    else if (r.connected) answered.add(r.lead_id);
    else unanswered.add(r.lead_id);
  }
  for (const id of answered) unanswered.delete(id);
  for (const id of converted) { answered.delete(id); unanswered.delete(id); }
  return { closedAnswered: answered.size, converted: converted.size, closedUnanswered: unanswered.size };
}

export type AssignmentReason = "not_business_day" | "paused" | "review_lock" | "backlog_full" | "backlog_reduced" | "full_quota";

/**
 * Why a desk could receive today's count: the same order of checks as the
 * morning distribution (business day, pause, HQ review lock, Net-50 backlog).
 */
export function explainAssignment(input: { businessDay: boolean; paused: boolean; reviewLocked: boolean; backlog: number; quota: number; cap: { enabled: boolean; limit: number } }) {
  const allowed = !input.cap.enabled ? input.quota : Math.max(0, Math.min(input.quota, input.cap.limit - input.backlog));
  let reason: AssignmentReason;
  if (!input.businessDay) reason = "not_business_day";
  else if (input.reviewLocked) reason = "review_lock";
  else if (input.paused) reason = "paused";
  else if (allowed === 0) reason = "backlog_full";
  else if (allowed < input.quota) reason = "backlog_reduced";
  else reason = "full_quota";
  const blocked = reason === "not_business_day" || reason === "review_lock" || reason === "paused";
  return { allowed: blocked ? 0 : allowed, reason };
}

/** Comparison window: at most this many days at once. */
export const MAX_COMPARE_DAYS = 7;

/** Every calendar day from `from` to `to` (inclusive), capped; empty when invalid. */
export function compareDays(from: string, to: string, today: string): string[] {
  if (!auditableDay(from, today) || !auditableDay(to, today) || from > to) return [];
  const out: string[] = [];
  for (let d = from; d <= to && out.length < MAX_COMPARE_DAYS; ) {
    out.push(d);
    const n = new Date(`${d}T00:00:00Z`);
    n.setUTCDate(n.getUTCDate() + 1);
    d = n.toISOString().slice(0, 10);
  }
  return out;
}
