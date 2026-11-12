import { describe, expect, it } from "vitest";
import { closingReportOf, closureKind, isOutOfScope, measureClosure, type CallRow, type ClosingReport } from "@/lib/closure-attempts";

const closing = (p: Partial<ClosingReport> = {}): ClosingReport => ({ id: "r9", lead_id: "L", agent_id: "A", submitted_at: "2026-11-10T08:00:00Z", category: "no_answer", connected: false, no_follow_up_reason: "not_connected", ...p });
let n = 0;
const call = (p: Partial<CallRow> = {}): CallRow => ({ id: `c${++n}`, lead_id: "L", agent_id: "A", call_source: "android_dialer", call_status: "no_answer", duration_seconds: 0, talk_time_source: null, external_call_id: `log-${n}`, created_at: "2026-11-09T08:00:00Z", ...p });

describe("closure recovery rules", () => {
  it("an unreachable closure with only 2 phone-recorded attempts is short of the 3 required", () => {
    const g = measureClosure({ closing: closing(), reportsBefore: 3, calls: [call(), call()] });
    expect(g).toMatchObject({ kind: "unreachable", required: 3, verifiedAttempts: 2, short: true });
  });

  it("3 phone-recorded attempts are enough for an unreachable closure", () => {
    expect(measureClosure({ closing: closing(), reportsBefore: 3, calls: [call(), call(), call()] }).short).toBe(false);
  });

  it("web-timer and manual entries never count as verified attempts", () => {
    const g = measureClosure({ closing: closing(), reportsBefore: 5, calls: [call({ call_source: "web_callback" }), call({ call_source: "web_manual" }), call(), call()] });
    expect(g.verifiedAttempts).toBe(2);
  });

  it("the same physical call is counted once", () => {
    const g = measureClosure({ closing: closing(), reportsBefore: 3, calls: [call({ external_call_id: "x" }), call({ external_call_id: "x" }), call()] });
    expect(g.verifiedAttempts).toBe(2);
  });

  it("calls recorded after the closure do not count", () => {
    const g = measureClosure({ closing: closing(), reportsBefore: 3, calls: [call(), call(), call({ created_at: "2026-11-11T08:00:00Z" })] });
    expect(g.verifiedAttempts).toBe(2);
  });

  it("'not interested' needs a conversation the phone proved", () => {
    const c = closing({ category: "not_interested", connected: true, no_follow_up_reason: "not_interested" });
    const unproven = measureClosure({ closing: c, reportsBefore: 1, calls: [call({ call_source: "android_sim", call_status: "completed", duration_seconds: 40 })] });
    expect(unproven).toMatchObject({ kind: "conversation", provenConversations: 0, short: true });
    const proven = measureClosure({ closing: c, reportsBefore: 1, calls: [call({ call_source: "android_sim", call_status: "completed", duration_seconds: 40, talk_time_source: "call_log" })] });
    expect(proven.short).toBe(false);
  });

  it("a report verified from the phone call log proves the conversation, once per call", () => {
    const c = closing({ category: "not_interested", connected: true, no_follow_up_reason: "not_interested" });
    const g = measureClosure({ closing: c, reportsBefore: 1, calls: [call({ id: "rec1", call_source: "android_sim", call_status: "completed", duration_seconds: 40, talk_time_source: "call_log" })], verifiedReports: [{ recording_id: "rec1" }] });
    expect(g.provenConversations).toBe(1);
    expect(measureClosure({ closing: c, reportsBefore: 1, calls: [], verifiedReports: [{ recording_id: null }] }).short).toBe(false);
  });

  it("'not interested' without a connection still counts as a claimed conversation", () => {
    expect(closureKind({ category: "not_interested", connected: false, no_follow_up_reason: "not_interested" })).toBe("conversation");
  });

  it("sales and duplicate closures are out of scope", () => {
    expect(isOutOfScope({ category: "closed_converted", no_follow_up_reason: "not_connected" })).toBe(true);
    expect(isOutOfScope({ category: "not_interested", no_follow_up_reason: "duplicate" })).toBe(true);
    expect(isOutOfScope({ category: "not_interested", no_follow_up_reason: "not_interested" })).toBe(false);
  });

  it("a lead whose latest report set a follow-up is not a closure", () => {
    const reports = [{ id: "a", submitted_at: "2026-11-01T00:00:00Z", fu: null }, { id: "b", submitted_at: "2026-11-02T00:00:00Z", fu: "x" }];
    expect(closingReportOf(reports, r => r.fu === null)).toBeNull();
    expect(closingReportOf(reports.slice(0, 1), r => r.fu === null)?.id).toBe("a");
  });
});
