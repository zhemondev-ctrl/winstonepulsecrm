import { describe, expect, it } from "vitest";
import { nextHandoutAt, registrationBalances } from "@/lib/allocation-dashboard";
describe("allocation dashboard rules", () => {
  it("counts only today's accepted own receipts once against ten slots", () => {
    const rows = [{ id: "1", agent_id: "a", work_day: "2026-11-15" }, { id: "2", agent_id: "a", work_day: "2026-11-14" }, { id: "3", agent_id: "other", work_day: "2026-11-15" }];
    expect(registrationBalances([{ id: "a" }], "2026-11-15", [...rows, rows[0]]) .get("a")).toEqual({ registered: 1, selfRemaining: 9, selfLimit: 10 });
  });
  it("never shows negative self slots", () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ id: String(i), agent_id: "a", work_day: "2026-11-15" }));
    expect(registrationBalances([{ id: "a" }], "2026-11-15", rows).get("a")?.selfRemaining).toBe(0);
  });
  it("counts down to 09:10 Dhaka, not UTC", () => {
    expect(nextHandoutAt(Date.parse("2026-11-15T01:21:00+06:00"), null)).toBe("2026-11-15T03:10:00.000Z");
  });
  it("skips Friday and configured clearance days", () => {
    expect(nextHandoutAt(Date.parse("2026-11-12T10:00:00+06:00"), null)).toBe("2026-11-15T03:10:00.000Z");
    expect(nextHandoutAt(Date.parse("2026-11-15T01:00:00+06:00"), { days: ["2026-11-15"] })).toBe("2026-11-16T03:10:00.000Z");
  });
  it("moves to the next scheduled day after 09:10", () => {
    expect(nextHandoutAt(Date.parse("2026-11-15T09:10:00+06:00"), null)).toBe("2026-11-16T03:10:00.000Z");
  });
});