import { describe, it, expect } from "vitest";
import { evaluatePhoneAcceptance, type AcceptanceCall } from "@/lib/phone-acceptance";

const now = Date.parse("2026-11-02T06:00:00Z");
const device = { id: "dev1", app_version: "2.21", last_seen_at: "2026-11-02T05:00:00Z", created_at: "2026-11-01T00:00:00Z" };
const call = (o: Partial<AcceptanceCall> = {}): AcceptanceCall => ({
  device_id: "dev1", agent_id: "a1", created_at: "2026-11-02T05:30:00Z", call_status: "completed",
  duration_seconds: 30, call_source: "android_sim", talk_time_source: "call_log", ...o,
});
const run = (o: { d?: Partial<typeof device> & { revoked_at?: string | null }; calls?: AcceptanceCall[] } = {}) =>
  evaluatePhoneAcceptance({ device: { ...device, ...o.d }, agentId: "a1", calls: o.calls ?? [call()], expectedVersion: "2.21", now });
const step = (r: ReturnType<typeof run>, k: string) => r.steps.find((s) => s.key === k)!;

describe("real phone acceptance checklist", () => {
  it("does not pass on a device-claimed call-log mark alone (spoofable)", () => {
    // Security fix: talk_time_source is sent by the device and caller-controlled,
    // so it no longer proves talk time; the call step stays unverified.
    const r = run();
    expect(step(r, "call").status).not.toBe("pass");
    expect(r.ready).toBe(false);
  });

  it("passes the test build IT currently hands out, but names it as a test build", () => {
    const r = evaluatePhoneAcceptance({ device: { ...device, app_version: "2.21-test" }, agentId: "a1", calls: [call()], expectedVersion: "2.21-test", now });
    expect(r.steps[0]).toEqual({ key: "install", status: "pass", reason: "current_test_build" });
  });

  it("flags a test build that is not the current download", () => {
    const r = run({ d: { app_version: "2.20-test" } });
    expect(step(r, "install")).toEqual({ key: "install", status: "warn", reason: "test_build" });
    expect(r.ready).toBe(false);
  });

  it("waits on sign-in when the phone was not seen in 24 hours", () => {
    expect(step(run({ d: { last_seen_at: "2026-10-31T05:00:00Z" } }), "signin").status).toBe("waiting");
  });

  it("does not pass a call whose talk time is not from the phone's call history", () => {
    const r = run({ calls: [call({ talk_time_source: null })] });
    expect(step(r, "call")).toEqual({ key: "call", status: "warn", reason: "not_verified" });
  });

  it("does not pass an unanswered call", () => {
    expect(step(run({ calls: [call({ call_status: "no_answer", duration_seconds: 0 })] }), "call").reason).toBe("not_completed");
  });

  it("ignores calls from another phone, another agent, or before the phone registered", () => {
    const r = run({ calls: [call({ device_id: "dev2" }), call({ agent_id: "a2" }), call({ created_at: "2026-10-30T00:00:00Z" })] });
    expect(step(r, "call")).toEqual({ key: "call", status: "waiting", reason: "no_call" });
  });
});
