import { describe, expect, it } from "vitest";
import { checkCompanyAssignment, type CompanyRunEvidence } from "@/lib/company-assignment-check";
const day = "2026-11-15";
const at = (time: string) => Date.parse(`${day}T${time}+06:00`);
const run: CompanyRunEvidence = { work_date: day, status: "completed", trigger: "daily_auto", moved: 50, updated_at: `${day}T09:11:00+06:00` };
describe("9:10 AM company operations evidence", () => {
  it("waits before exactly 9:10 Dhaka and warns at 9:10 without a receipt", () => {
    expect(checkCompanyAssignment(day, null, null, at("09:09:59")).state).toBe("waiting");
    expect(checkCompanyAssignment(day, null, null, at("09:10:00")).state).toBe("missing");
  });
  it("confirms only a completed same-day automatic receipt", () => {
    expect(checkCompanyAssignment(day, run, null, at("09:12:00"))).toMatchObject({ state: "confirmed", moved: 50 });
    expect(checkCompanyAssignment(day, { ...run, trigger: "manual" }, null, at("09:12:00")).state).toBe("manual_only");
    expect(checkCompanyAssignment(day, { ...run, status: "running" }, null, at("09:12:00")).state).toBe("unconfirmed");
    expect(checkCompanyAssignment(day, { ...run, work_date: "2026-11-14" }, null, at("09:12:00")).state).toBe("missing");
  });
  it("rejects invalid, future and pre-schedule completion timestamps", () => {
    for (const updated_at of ["invalid", `${day}T09:09:00+06:00`, `${day}T10:00:00+06:00`, "2026-11-14T09:11:00+06:00"]) {
      expect(checkCompanyAssignment(day, { ...run, updated_at }, null, at("09:12:00")).state).toBe("unconfirmed");
    }
  });
  it("does not call Friday or configured pause days missed assignments", () => {
    expect(checkCompanyAssignment("2026-11-13", null, null, at("12:00:00")).state).toBe("friday");
    expect(checkCompanyAssignment("2026-11-14", null, null, at("12:00:00")).state).toBe("paused");
    expect(checkCompanyAssignment(day, null, { days: [day] }, at("12:00:00")).state).toBe("paused");
  });
  it("a completed zero-allocation run is not confused with a missing run", () => {
    expect(checkCompanyAssignment(day, { ...run, moved: 0 }, null, at("09:12:00"))).toMatchObject({ state: "confirmed", moved: 0 });
  });
});