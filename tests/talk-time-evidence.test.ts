import { describe, expect, it } from "vitest";
import { talkTimeEvidence } from "@/lib/call-reconciliation";

describe("call-history talk-time evidence from the phone", () => {
  it("device-sent call-log marks are never trusted as proof (spoofable)", () => {
    expect(talkTimeEvidence({ state: "completed", duration_seconds: 48 })).toEqual({}); // app 2.21: no mark
    // Security fix: a device-sent talk_time_source is caller-controlled, so it
    // must not be stored as verified evidence even when it claims call_log.
    expect(talkTimeEvidence({ state: "completed", duration_seconds: 48, talk_time_source: "call_log" })).toEqual({});
  });
  it("an unanswered call from call history stores no verified talk time", () => {
    expect(talkTimeEvidence({ state: "no_answer", duration_seconds: 30, talk_time_source: "call_log" })).toEqual({});
  });
  it("completed with no talk time, or a non-final state, is not evidence", () => {
    expect(talkTimeEvidence({ state: "completed", duration_seconds: 0, talk_time_source: "call_log" })).toEqual({});
    expect(talkTimeEvidence({ state: "failed", talk_time_source: "call_log" })).toEqual({});
    expect(talkTimeEvidence({ state: "initiated", duration_seconds: 10, talk_time_source: "call_log" })).toEqual({});
  });
});
