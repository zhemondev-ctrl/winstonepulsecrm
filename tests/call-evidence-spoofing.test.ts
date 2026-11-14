import { expect, test } from "vitest";
import { talkTimeEvidence, callLogReconcilePatch } from "@/lib/call-reconciliation";
import { isCallLogConfirmed } from "@/lib/call-log-confirmed";
import { isPhoneMeasuredCall } from "@/lib/call-duration";
import { verifyLeadFromCallEvidence } from "@/lib/lead-verification";

test("chosen completed state, duration and call_log flag cannot mint proof", () => {
  expect(talkTimeEvidence({ state: "completed", duration_seconds: 86400, talk_time_source: "call_log" })).toEqual({});
});

test("late matching does not turn claimant data into independent evidence", () => {
  const patch = callLogReconcilePatch({}, { state: "completed", durationSeconds: 60, atMs: 0, callUid: "log-forged" }, "2026-11-14T15:42:00Z");
  expect(patch.talk_time_source).toBeNull();
  expect(patch.talk_time_verified_at).toBeNull();
  expect(isCallLogConfirmed(patch)).toBe(false);
});

test("historical labels, reserved IDs and recorder claims cannot award verified credit", () => {
  for (const source of ["android_sim", "android_dialer", "android_incoming", "phone_recorder"]) {
    const row = { agent_id: "a", lead_id: "l", call_source: source, call_status: "completed", external_call_id: "log-forged", talk_time_source: "call_log", duration_seconds: 120 };
    expect(isPhoneMeasuredCall(row)).toBe(false);
    expect(isCallLogConfirmed(row)).toBe(false);
    expect(verifyLeadFromCallEvidence({ agentId: "a", leadId: "l", callUid: "log-forged", row })).toEqual({ verified: false, reason: "not_phone_measured" });
  }
});