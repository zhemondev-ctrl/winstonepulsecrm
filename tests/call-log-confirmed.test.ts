import { expect, test } from "vitest";
import { confirmedLeadsPerDay, isCallLogConfirmed } from "@/lib/call-log-confirmed";
test("only call-log talk time counts as answered", () => {
  expect(isCallLogConfirmed({ talk_time_source: "call_log", duration_seconds: 30 })).toBe(true);
  expect(isCallLogConfirmed({ talk_time_source: "device_timer", duration_seconds: 30 })).toBe(false);
  expect(isCallLogConfirmed({ talk_time_source: "call_log", duration_seconds: 0 })).toBe(false);
});
test("leads per day counts each lead once", () => {
  const r = (id: string, lead: string, at: string) => ({ id, agent_id: "a", lead_id: lead, talk_time_source: "call_log", duration_seconds: 20, started_at: at });
  expect(confirmedLeadsPerDay([r("1", "x", "2026-11-12T04:00:00Z"), r("2", "x", "2026-11-12T05:00:00Z"), r("3", "y", "2026-11-12T06:00:00Z")])).toEqual([{ day: "2026-11-12", leads: 2 }]);
});
