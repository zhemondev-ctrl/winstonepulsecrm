/** Pure rules for meeting approval requests (IT creates, Executive HQ decides). */
export const MEETING_DECISIONS = ["approved", "approved_with_changes", "rejected"] as const;
export type MeetingDecision = (typeof MEETING_DECISIONS)[number];
export type MeetingItemDecision = MeetingDecision | "pending";
export type MeetingStatus = "awaiting" | "decided" | "withdrawn";

export const MAX_MEETING_ITEMS = 30;

export function dhakaDecisionToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(now);
}

export function validMdDecisionDate(date: string, meetingDate: string, today = dhakaDecisionToday()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date && date >= meetingDate && date <= today;
}

/** "Approve with changes" and "Reject" must say why. */
export function decisionNeedsComment(decision: MeetingDecision) {
  return decision !== "approved";
}

/** HQ may submit the final decision only when every item has a decision. */
export function canFinalize(items: { decision: MeetingItemDecision }[]) {
  return items.length > 0 && items.every((i) => i.decision !== "pending");
}

export function decisionCounts(items: { decision: MeetingItemDecision }[]) {
  const out = { pending: 0, approved: 0, approved_with_changes: 0, rejected: 0 };
  for (const i of items) out[i.decision] += 1;
  return out;
}

/** The link IT sends on WhatsApp opens the Executive HQ approvals section. */
export function meetingApprovalPath(id: string) {
  return `/hq?s=approvals&approval=${encodeURIComponent(id)}`;
}

export type ImplementationStatus = "not_started" | "implemented";
/** Where one meeting decision stands on the way to a CRM rule change. */
export type TrackerStage = "awaiting_md" | "ready" | "implemented" | "rejected" | "withdrawn";

export function trackerStage(item: { decision: MeetingItemDecision; implementation_status: ImplementationStatus }, requestStatus: MeetingStatus): TrackerStage {
  if (requestStatus === "withdrawn") return "withdrawn";
  if (item.implementation_status === "implemented") return "implemented";
  if (requestStatus !== "decided" || item.decision === "pending") return "awaiting_md";
  if (item.decision === "rejected") return "rejected";
  return "ready";
}

/** A rule may change only after HQ submitted the MD's final written decision and the item was approved. */
export function canMarkImplemented(item: { decision: MeetingItemDecision; implementation_status: ImplementationStatus }, requestStatus: MeetingStatus) {
  return trackerStage(item, requestStatus) === "ready";
}
