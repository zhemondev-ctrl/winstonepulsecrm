/**
 * Backlog cap ("Net 50") and morning auto-distribution pause — pure rules.
 * MD approval report, 11 Nov 2026, proposals 3 and 4.
 *
 * Net 50: a desk's new company leads for the day = limit − its older pending
 * company backlog (never below 0, never above the normal daily quota). Leads
 * already received today are not backlog, so a second run only fills real gaps.
 * Self-collected leads are never backlog and never capped.
 */
export type BacklogCap = { enabled: boolean; limit: number };
export const DEFAULT_BACKLOG_CAP: BacklogCap = { enabled: true, limit: 50 };
export const BACKLOG_CAP_CONFIG_ID = "distribution_backlog_cap";
export const AUTO_PAUSE_CONFIG_ID = "auto_distribution_pause";

export function readBacklogCap(data: unknown): BacklogCap {
  const d = (data ?? {}) as { enabled?: unknown; limit?: unknown };
  const limit = typeof d.limit === "number" && Number.isInteger(d.limit) && d.limit >= 0 && d.limit <= 500 ? d.limit : DEFAULT_BACKLOG_CAP.limit;
  return { enabled: typeof d.enabled === "boolean" ? d.enabled : DEFAULT_BACKLOG_CAP.enabled, limit };
}

/** Daily quota after the backlog cap. */
export function cappedQuota(quota: number, backlog: number, cap: BacklogCap): number {
  if (!cap.enabled) return quota;
  return Math.max(0, Math.min(quota, cap.limit - backlog));
}

/**
 * Built-in clearance days used until a saved setting replaces them: the report's
 * 12–14 Nov window. 12 Nov had already been distributed and 13 Nov is Friday,
 * so only Saturday 14 Nov changes.
 */
export const DEFAULT_PAUSED_DAYS = ["2026-11-14"];

/** Days (Dhaka YYYY-MM-DD) on which the morning auto-distribution is paused. */
export function pausedDays(data: unknown): string[] {
  if (data == null) return DEFAULT_PAUSED_DAYS;
  const days = (data as { days?: unknown } | null)?.days;
  return Array.isArray(days) ? days.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
}

export function isAutoDistributionPaused(day: string, data: unknown): boolean {
  return pausedDays(data).includes(day);
}
