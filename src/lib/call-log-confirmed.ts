/**
 * Device call-log flags, durations and IDs are self-attested. Until an
 * independent authenticated witness is integrated, no row earns verified
 * answered-call credit. Historical data stays stored unchanged. Pure, no I/O.
 */
import { dhakaDay } from "@/lib/lead-groups";

export type ConfirmRow = { id: string; agent_id: string | null; lead_id: string | null; talk_time_source?: string | null; duration_seconds?: number | null; started_at?: string | null; created_at?: string | null };

export const isCallLogConfirmed = (_r: Pick<ConfirmRow, "talk_time_source" | "duration_seconds">): boolean => {
  // No independently authenticated call-evidence provider is integrated yet.
  // Historical call_log flags were also device claims: do not grandfather them.
  return false;
};

/** Distinct leads per Dhaka day with at least one call-log-confirmed answered call. */
export function confirmedLeadsPerDay(rows: ConfirmRow[]) {
  const days = new Map<string, Set<string>>();
  for (const r of rows) {
    const at = r.started_at ?? r.created_at;
    if (!r.lead_id || !at || !isCallLogConfirmed(r)) continue;
    const d = dhakaDay(at);
    if (!days.has(d)) days.set(d, new Set());
    days.get(d)?.add(r.lead_id);
  }
  return [...days].map(([day, s]) => ({ day, leads: s.size })).sort((a, b) => a.day.localeCompare(b.day));
}
