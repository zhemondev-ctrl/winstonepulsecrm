/**
 * A call counts as answered only when the phone's own Android call history
 * (talk_time_source = "call_log") recorded talk time above zero. The app's
 * "connected" flag and dial-to-hang-up timers never count — why: app 2.21
 * counted ringing as talk. Pure, no I/O.
 */
import { dhakaDay } from "@/lib/lead-groups";

export type ConfirmRow = { id: string; agent_id: string | null; lead_id: string | null; talk_time_source?: string | null; duration_seconds?: number | null; started_at?: string | null; created_at?: string | null };

export const isCallLogConfirmed = (r: Pick<ConfirmRow, "talk_time_source" | "duration_seconds">) =>
  r.talk_time_source === "call_log" && Number(r.duration_seconds ?? 0) > 0;

/** Distinct leads per Dhaka day with at least one call-log-confirmed answered call. */
export function confirmedLeadsPerDay(rows: ConfirmRow[]) {
  const days = new Map<string, Set<string>>();
  for (const r of rows) {
    const at = r.started_at ?? r.created_at;
    if (!r.lead_id || !at || !isCallLogConfirmed(r)) continue;
    const d = dhakaDay(at);
    if (!days.has(d)) days.set(d, new Set());
    days.get(d)!.add(r.lead_id);
  }
  return [...days].map(([day, s]) => ({ day, leads: s.size })).sort((a, b) => a.day.localeCompare(b.day));
}
