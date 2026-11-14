import { isDistributionDay } from "./business-day";
import { isAutoDistributionPaused } from "./backlog-cap";

export type CompanyRunEvidence = {
  work_date: string; status: string; trigger: string;
  moved: number; updated_at: string;
};

/** A schedule or daily total is not proof that the automatic job completed. */
export function checkCompanyAssignment(day: string, run: CompanyRunEvidence | null, pause: unknown, now = Date.now()) {
  const scheduledAt = `${day}T09:10:00+06:00`;
  const evidence = run?.work_date === day ? run : null;
  const completedAt = evidence ? Date.parse(evidence.updated_at) : NaN;
  const inDay = Number.isFinite(completedAt) && completedAt >= Date.parse(`${day}T00:00:00+06:00`) && completedAt < Date.parse(`${day}T00:00:00+06:00`) + 864e5;
  const confirmed = evidence?.trigger === "daily_auto" && evidence.status === "completed" && inDay && completedAt >= Date.parse(scheduledAt) && completedAt <= now;
  const state: "confirmed" | "friday" | "paused" | "waiting" | "manual_only" | "unconfirmed" | "missing" = confirmed ? "confirmed" : !isDistributionDay(day) ? "friday" : isAutoDistributionPaused(day, pause) ? "paused" : now < Date.parse(scheduledAt) ? "waiting" : evidence?.trigger === "manual" ? "manual_only" : evidence ? "unconfirmed" : "missing";
  return { day, scheduledAt, state, checkedAt: new Date(now).toISOString(), completedAt: confirmed ? evidence.updated_at : null, moved: confirmed ? evidence.moved : null };
}