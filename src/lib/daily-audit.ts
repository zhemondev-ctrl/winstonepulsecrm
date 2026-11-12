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
