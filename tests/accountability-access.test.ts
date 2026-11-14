import { describe, expect, it } from "vitest";
import { accountabilityReviewer } from "@/lib/accountability-access";

describe("accountability approval authority", () => {
  it("allows full IT PIN to approve with an IT audit label", () => {
    expect(accountabilityReviewer("full")).toBe("IT Console");
  });
  it("preserves HQ approval", () => {
    expect(accountabilityReviewer("hq")).toBe("Executive HQ");
  });
  it.each([null, undefined, "leadhub", "agent", "admin", ""])("refuses non-review scope %s", (scope) => {
    expect(accountabilityReviewer(scope)).toBeNull();
  });
});