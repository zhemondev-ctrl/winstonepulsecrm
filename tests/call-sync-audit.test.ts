import { describe, expect, it } from "vitest";
import { toSyncFailureEvent, type SyncFailureRow } from "@/lib/android-sync-failures";
import { buildCallSyncAudit, failureEntry, successEntry } from "@/lib/call-sync-audit";

const names = new Map([["a", "Rahim"]]);
const fail = (payload: Record<string, unknown>): SyncFailureRow => ({
  id: crypto.randomUUID(), agent_id: "a", device_id: null, created_at: "2026-11-01T06:30:00.000Z",
  payload: { item_kind: "outcome", error_kind: "NETWORK", attempts: 2, count: 1, last_at: "2026-11-01T06:20:00.000Z", ...payload },
});

describe("call sync audit log", () => {
  it("retryable failure shows retrying with its reason; permanent shows stopped", () => {
    const r = failureEntry(toSyncFailureEvent(fail({}), names, new Map()))!;
    expect(r.state).toBe("retrying");
    expect(r.reason).toBe("No internet on the phone");
    expect(r.attempts).toBe(2);
    const p = failureEntry(toSyncFailureEvent(fail({ error_kind: "ACCESS_DENIED", permanent: true }), names, new Map()))!;
    expect(p.state).toBe("stopped");
  });

  it("non-call failures (new lead) are excluded", () => {
    expect(failureEntry(toSyncFailureEvent(fail({ item_kind: "lead_submit" }), names, new Map()))).toBeNull();
  });

  it("successes are saved, non-call events excluded, bad lead ids dropped", () => {
    const s = successEntry({ id: "1", agent_id: "a", event_type: "dialer_completed", created_at: "2026-11-01T06:00:00Z", processed_at: null, lead_id: "x" }, names)!;
    expect(s.state).toBe("saved");
    expect(s.leadId).toBeNull();
    expect(successEntry({ id: "2", agent_id: "a", event_type: "device_bound", created_at: "", processed_at: null, lead_id: null }, names)).toBeNull();
  });

  it("totals count failure repeats and order is newest first", () => {
    const s = successEntry({ id: "1", agent_id: "a", event_type: "report_submitted", created_at: "2026-11-01T07:00:00Z", processed_at: null, lead_id: null }, names)!;
    const f = failureEntry(toSyncFailureEvent(fail({ count: 3 }), names, new Map()))!;
    const out = buildCallSyncAudit([s], [f]);
    expect(out.totals).toEqual({ saved: 1, retrying: 3, stopped: 0 });
    expect(out.entries[0]!.id).toBe("1");
  });
});
