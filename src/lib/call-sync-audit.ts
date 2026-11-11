/**
 * Call sync audit log: one read-only, chronological list of every call-related
 * phone sync result — saved in the CRM, or failed with its reason and retry state.
 *
 * Pure and browser-safe. Successes come from processed sync_events of call types;
 * failures come from android_sync_failure reports (see android-sync-failures.ts).
 * Never carries phone numbers, names of customers, audio or server message text.
 * A failure is never shown as "later delivered": successes carry no call fingerprint,
 * so the two cannot be proven to be the same call.
 */
import { ITEM_LABEL, NEXT_STEP, type SyncFailureEvent, type SyncItemKind } from "@/lib/android-sync-failures";

export const CALL_SUCCESS_EVENTS = [
  "dialer_completed",
  "dialer_no_answer",
  "incoming_completed",
  "incoming_no_answer",
  "lead_event_call_started",
  "lead_event_call_ended",
  "report_submitted",
] as const;
export type CallSuccessEvent = (typeof CALL_SUCCESS_EVENTS)[number];

export const CALL_FAILURE_ITEMS: readonly SyncItemKind[] = [
  "call_state", "incoming_call", "outcome", "report_open", "report_submit", "recording", "recording_pickup",
];

export const SUCCESS_LABEL: Record<CallSuccessEvent, string> = {
  dialer_completed: "Outgoing call — answered",
  dialer_no_answer: "Outgoing call — not answered",
  incoming_completed: "Incoming call — answered",
  incoming_no_answer: "Incoming call — missed",
  lead_event_call_started: "Call start saved to lead history",
  lead_event_call_ended: "Call end saved to lead history",
  report_submitted: "Call report submitted",
};

export type RetryState = "saved" | "retrying" | "stopped";
export const RETRY_LABEL: Record<RetryState, string> = {
  saved: "Saved in CRM · সংরক্ষিত",
  retrying: "Phone retrying automatically · পুনরায় পাঠানো চলছে",
  stopped: "Stopped — needs a person · থেমে আছে, ব্যবস্থা দরকার",
};

export type SuccessRow = {
  id: string;
  agent_id: string | null;
  event_type: string;
  created_at: string;
  processed_at: string | null;
  lead_id: string | null;
};

export type CallSyncAuditEntry = {
  id: string;
  atUtc: string;
  agentId: string | null;
  agentName: string;
  what: string;
  state: RetryState;
  reason: string | null;
  nextStep: string | null;
  attempts: number | null;
  timesSeen: number | null;
  httpStatus: number | null;
  callRef: string | null;
  leadId: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCallSuccessEvent(t: string): t is CallSuccessEvent {
  return (CALL_SUCCESS_EVENTS as readonly string[]).includes(t);
}

export function retryStateOf(e: Pick<SyncFailureEvent, "permanent">): RetryState {
  return e.permanent ? "stopped" : "retrying";
}

export function successEntry(r: SuccessRow, names: Map<string, string>): CallSyncAuditEntry | null {
  if (!isCallSuccessEvent(r.event_type)) return null;
  return {
    id: r.id,
    atUtc: r.processed_at ?? r.created_at,
    agentId: r.agent_id,
    agentName: (r.agent_id && names.get(r.agent_id)) || "Unknown agent",
    what: SUCCESS_LABEL[r.event_type],
    state: "saved",
    reason: null,
    nextStep: null,
    attempts: null,
    timesSeen: null,
    httpStatus: null,
    callRef: null,
    leadId: r.lead_id && UUID.test(r.lead_id) ? r.lead_id : null,
  };
}

export function failureEntry(e: SyncFailureEvent): CallSyncAuditEntry | null {
  if (!CALL_FAILURE_ITEMS.includes(e.itemKind)) return null;
  return {
    id: e.id,
    atUtc: e.lastAtUtc,
    agentId: e.agentId,
    agentName: e.agentName,
    what: ITEM_LABEL[e.itemKind],
    state: retryStateOf(e),
    reason: NEXT_STEP[e.errorKind].label,
    nextStep: NEXT_STEP[e.errorKind].step,
    attempts: e.attempts,
    timesSeen: e.count,
    httpStatus: e.httpStatus,
    callRef: e.callRef,
    leadId: null,
  };
}

/** Newest first; counts per state use failure repeat counts, never guesses. */
export function buildCallSyncAudit(successes: CallSyncAuditEntry[], failures: CallSyncAuditEntry[]) {
  const entries = [...successes, ...failures].sort((a, b) => b.atUtc.localeCompare(a.atUtc) || a.id.localeCompare(b.id));
  const totals = { saved: 0, retrying: 0, stopped: 0 } as Record<RetryState, number>;
  for (const e of entries) totals[e.state] += e.state === "saved" ? 1 : (e.timesSeen ?? 1);
  return { entries, totals };
}
