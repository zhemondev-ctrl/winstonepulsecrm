import { describe, expect, it } from "vitest";
import { summarizeCallLogMatches } from "@/lib/call-log-match-summary";
import { hqCallLogParams } from "@/lib/hq-daily-report";

const agents = [{ id: "a1", name: "Rina" }, { id: "a2", name: "Karim" }];

describe("daily call-log match summary", () => {
  it("does not count self-attested call-log talk as verified or reached", () => {
    const s = summarizeCallLogMatches({ agents, failures: [], calls: [
      { agent_id: "a1", lead_id: "L1", call_source: "android_sim", call_status: "completed", duration_seconds: 75, talk_time_source: "call_log" },
      { agent_id: "a1", lead_id: "L1", call_source: "android_sim", call_status: "completed", duration_seconds: 40, talk_time_source: "call_log" },
    ] });
    expect(s.team.matched).toBe(0);
    expect(s.team.verifiedLeads).toBe(0);
  });

  it("never counts ringing-only app time (no call-log mark) as matched", () => {
    const s = summarizeCallLogMatches({ agents, failures: [], calls: [
      { agent_id: "a1", lead_id: "L1", call_source: "android_sim", call_status: "completed", duration_seconds: 40, talk_time_source: null },
    ] });
    expect(s.team.matched).toBe(0);
    expect(s.team.notMatched).toBe(1);
    expect(s.team.verifiedLeads).toBe(0);
  });

  it("separates call-log no-answer and web calls", () => {
    const s = summarizeCallLogMatches({ agents, failures: [], calls: [
      { agent_id: "a2", call_source: "android_dialer", call_status: "no_answer", duration_seconds: 0, talk_time_source: "call_log" },
      { agent_id: "a2", call_source: "web", call_status: "completed", duration_seconds: 90 },
    ] });
    expect(s.team.noAnswer).toBe(1);
    expect(s.team.noPhoneLog).toBe(1);
  });

  it("groups phone send failures by reason and maps unknown reasons to UNKNOWN", () => {
    const s = summarizeCallLogMatches({ agents, calls: [], failures: [
      { agent_id: "a1", error_kind: "NETWORK" }, { agent_id: "a1", error_kind: "NETWORK" }, { agent_id: "a2", error_kind: "bogus" },
    ] });
    expect(s.team.failures).toEqual({ NETWORK: 2, UNKNOWN: 1 });
    expect(s.team.failureTotal).toBe(3);
  });

  it("ignores rows from people who are not active agents", () => {
    const s = summarizeCallLogMatches({ agents, failures: [{ agent_id: "x", error_kind: "NETWORK" }], calls: [
      { agent_id: "x", lead_id: "L9", call_source: "android_sim", call_status: "completed", duration_seconds: 60, talk_time_source: "call_log" },
    ] });
    expect(s.team.matched).toBe(0);
    expect(s.team.failureTotal).toBe(0);
  });

  it("WhatsApp summary carries exactly six count-only values", () => {
    const p = hqCallLogParams("2026-11-02", { verifiedLeads: 12, matched: 15, noAnswer: 30, notMatched: 4, failureTotal: 2 });
    expect(p).toEqual(["২ নভেম্বর ২০২৬", "১২", "১৫", "৩০", "৪", "২"]);
  });
});
