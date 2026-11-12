import { describe, expect, it } from "vitest";
import { isParked, nextOpenSlot, planNoAnswer, RetryPlanError, dhakaSlotIso } from "@/lib/no-answer-cadence";

// Mon 2026-10-12 12:00 Dhaka
const NOW = Date.parse("2026-10-12T06:00:00Z");

describe("did-not-receive cadence", () => {
  it("attempt 1 comes back the same day, 2 hours later, ignoring the pick", () => {
    const p = planNoAnswer(1, { mode: "plus2", slot: "evening" }, NOW);
    expect(p.stage).toBe("snooze");
    expect(p.retryAt).toBe(dhakaSlotIso("2026-10-12", "14:00"));
  });
  it("attempt 1 after 17:00 Dhaka moves to the next working morning", () => {
    const late = Date.parse("2026-10-12T10:00:00Z"); // 16:00 Dhaka → 18:00 is too late
    expect(planNoAnswer(1, null, late).retryAt).toBe(dhakaSlotIso("2026-10-13", "10:30"));
  });
  it("attempt 1 on a Thursday evening skips Friday", () => {
    const thuLate = Date.parse("2026-10-15T12:00:00Z"); // Thu 18:00 Dhaka
    expect(planNoAnswer(1, null, thuLate).retryAt).toBe(dhakaSlotIso("2026-10-17", "10:30"));
  });
  it("attempt 2 defaults to +2 working days with the soft message stage", () => {
    const p = planNoAnswer(2, null, NOW);
    expect(p.stage).toBe("snooze_soft");
    expect(p.retryAt).toBe(dhakaSlotIso("2026-10-14", "10:30"));
  });
  it("attempt 2 +1 working day uses the chosen slot", () => {
    expect(planNoAnswer(2, { mode: "plus1", slot: "evening" }, NOW).retryAt).toBe(dhakaSlotIso("2026-10-13", "18:00"));
  });
  it("older apps sending +3 days are capped at 2 working days", () => {
    expect(planNoAnswer(2, { mode: "plus3", slot: "morning" }, NOW).retryAt).toBe(dhakaSlotIso("2026-10-14", "10:30"));
  });
  it("2 working days skip Friday (Wed → Sat)", () => {
    const wed = Date.parse("2026-10-14T06:00:00Z");
    expect(planNoAnswer(2, { mode: "plus2", slot: "afternoon" }, wed).retryAt).toBe(dhakaSlotIso("2026-10-17", "15:00"));
  });
  it("attempt 2 refuses a custom date beyond 2 working days", () => {
    expect(() => planNoAnswer(2, { mode: "custom", slot: "custom", customAt: dhakaSlotIso("2026-10-15", "10:00") }, NOW)).toThrow("within 2 working days");
  });
  it("attempt 3 goes to unresponsive, 7 days later, ignoring the pick", () => {
    const p = planNoAnswer(3, { mode: "plus2", slot: "evening" }, NOW);
    expect(p.stage).toBe("unresponsive");
    expect(p.retryAt).toBe(dhakaSlotIso("2026-10-19", "10:30"));
  });
  it("holidays are skipped too", () => {
    const r = nextOpenSlot(dhakaSlotIso("2026-10-17", "10:30"), ["2026-10-17"]);
    expect(r.at).toBe(dhakaSlotIso("2026-10-18", "10:30"));
  });
  it("refuses a past custom time", () => {
    expect(() => planNoAnswer(2, { mode: "custom", slot: "custom", customAt: "2026-10-11T06:00:00Z" }, NOW)).toThrow(RetryPlanError);
  });
  it("parked leads stay off the dial list until due", () => {
    expect(isParked({ work_state: "snoozed", retry_after: "2026-10-14T00:00:00Z" }, NOW)).toBe(true);
    expect(isParked({ work_state: "snoozed", retry_after: "2026-10-11T00:00:00Z" }, NOW)).toBe(false);
    expect(isParked({ work_state: "pending", retry_after: "2026-10-14T00:00:00Z" }, NOW)).toBe(false);
  });
});
