import { describe, expect, it } from "vitest";
import { shouldSubscribeToCrm } from "@/lib/crm-live-refresh";

describe("CRM subscription eligibility", () => {
  it("does not subscribe before access is resolved", () => {
    expect(shouldSubscribeToCrm(true, "authority")).toBe(false);
  });
  it("does not subscribe for signed-out visitors", () => {
    expect(shouldSubscribeToCrm(false, "none")).toBe(false);
  });
  it.each(["agent", "authority"])("preserves live refresh for %s access", scope => {
    expect(shouldSubscribeToCrm(false, scope)).toBe(true);
  });
});