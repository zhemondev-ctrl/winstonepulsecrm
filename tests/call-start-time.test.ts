import { describe, expect, it } from "vitest";
import { plausibleCallStart } from "@/lib/call-reports.server";

const now = Date.parse("2026-11-12T08:00:00Z");
describe("saved call start time", () => {
  it("keeps the phone's start time", () => {
    expect(plausibleCallStart("2026-11-12T07:55:00Z", now)).toBe("2026-11-12T07:55:00.000Z");
  });
  it("refuses a start time in the future", () => {
    expect(plausibleCallStart("2026-11-12T09:00:00Z", now)).toBeNull();
  });
  it("refuses a start time older than one day", () => {
    expect(plausibleCallStart("2026-11-10T07:00:00Z", now)).toBeNull();
  });
  it("missing time is left for the database to stamp", () => {
    expect(plausibleCallStart(null, now)).toBeNull();
  });
});
