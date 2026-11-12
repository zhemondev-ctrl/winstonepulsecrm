/**
 * Closed leads without enough verified call attempts — pure rules, no I/O.
 *
 * Read-only review signal for Executive HQ. It never reopens, reassigns or
 * edits a lead and does not change the closure policy.
 *
 * - "Unreachable" closure (no connection, "did not receive" style): needs
 *   UNREACHABLE_MIN_ATTEMPTS phone-recorded call attempts, matching the
 *   3-strike cadence before a lead counts as unresponsive.
 * - "Conversation" closure (not interested, wrong number, other…): needs at
 *   least one conversation the phone proved (completed, real talk time,
 *   hasProvenTalkTime), or a report the server marked connection_verified from
 *   the phone's call log. A web timer or a typed duration is a claim, not proof.
 * Sales (converted) and duplicate closures are out of scope.
 */
import { hasProvenTalkTime } from "@/lib/lead-verification";

export const UNREACHABLE_MIN_ATTEMPTS = 3;
export const CONVERSATION_MIN_PROVEN = 1;
/** Phone-side sources whose call rows prove a real dial from the agent's phone. */
export const PHONE_ATTEMPT_SOURCES = ["android_sim", "android_dialer", "phone_recorder"] as const;
const PHONE_SOURCES = new Set<string>(PHONE_ATTEMPT_SOURCES);
const UNREACHABLE_CATEGORIES = new Set(["no_answer", "busy", "failed", "callback", "follow_up"]);
const OUT_OF_SCOPE_REASONS = new Set(["converted", "duplicate"]);
/** Phone rows can land a little after the report is submitted. */
const LATE_SYNC_MS = 15 * 60_000;

export type ClosingReport = {
  id: string;
  lead_id: string;
  agent_id: string | null;
  submitted_at: string | null;
  category: string | null;
  connected: boolean | null;
  no_follow_up_reason: string | null;
};

export type CallRow = {
  id: string;
  lead_id: string | null;
  agent_id: string | null;
  call_source: string | null;
  call_status: string | null;
  duration_seconds: number | null;
  talk_time_source: string | null;
  external_call_id: string | null;
  created_at: string;
};

export type ClosureKind = "unreachable" | "conversation";
export type ClosureGap = {
  kind: ClosureKind;
  required: number;
  reportedAttempts: number;
  verifiedAttempts: number;
  provenConversations: number;
  short: boolean;
};

export function isOutOfScope(r: Pick<ClosingReport, "category" | "no_follow_up_reason">) {
  return OUT_OF_SCOPE_REASONS.has(String(r.no_follow_up_reason ?? "")) || r.category === "closed_converted";
}

export function closureKind(r: Pick<ClosingReport, "category" | "connected" | "no_follow_up_reason">): ClosureKind {
  if (r.connected) return "conversation";
  const reason = String(r.no_follow_up_reason ?? "");
  if (reason === "not_connected" || reason === "no_contact" || UNREACHABLE_CATEGORIES.has(String(r.category ?? ""))) return "unreachable";
  // "Not interested" / "wrong number" without a connection still claims a conversation.
  return "conversation";
}

/**
 * Measures one closure. Attempts by any agent on this lead up to the closure
 * count (earlier owners' calls are still attempts); each physical call once.
 */
export function measureClosure(input: {
  closing: ClosingReport;
  reportsBefore: number;
  calls: CallRow[];
  /** Reports up to the closure that the server verified from the phone call log. */
  verifiedReports?: { recording_id: string | null }[];
}): ClosureGap {
  const kind = closureKind(input.closing);
  const cutoff = Date.parse(input.closing.submitted_at ?? "") + LATE_SYNC_MS;
  const seen = new Set<string>();
  let verifiedAttempts = 0;
  let provenConversations = 0;
  const provenIds = new Set<string>();
  for (const c of input.calls) {
    if (c.lead_id !== input.closing.lead_id) continue;
    if (!PHONE_SOURCES.has(String(c.call_source ?? ""))) continue;
    if (Number.isFinite(cutoff) && Date.parse(c.created_at) > cutoff) continue;
    const key = c.external_call_id ? `x:${c.external_call_id}` : `id:${c.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    verifiedAttempts += 1;
    const seconds = c.duration_seconds;
    if (c.call_status === "completed" && typeof seconds === "number" && seconds > 0 && hasProvenTalkTime(c)) {
      provenConversations += 1;
      provenIds.add(c.id);
    }
  }
  for (const r of input.verifiedReports ?? []) {
    if (r.recording_id && provenIds.has(r.recording_id)) continue;
    if (r.recording_id) provenIds.add(r.recording_id);
    provenConversations += 1;
  }
  const required = kind === "unreachable" ? UNREACHABLE_MIN_ATTEMPTS : CONVERSATION_MIN_PROVEN;
  const short = kind === "unreachable" ? verifiedAttempts < required : provenConversations < required;
  return { kind, required, reportedAttempts: input.reportsBefore, verifiedAttempts, provenConversations, short };
}

/** The report that closed the lead: its latest submitted report, when that one set no follow-up. */
export function closingReportOf<T extends { submitted_at: string | null; id: string }>(reports: T[], isClose: (r: T) => boolean): T | null {
  const latest = [...reports].sort((a, b) => String(b.submitted_at ?? "").localeCompare(String(a.submitted_at ?? "")) || b.id.localeCompare(a.id))[0];
  return latest && isClose(latest) ? latest : null;
}
