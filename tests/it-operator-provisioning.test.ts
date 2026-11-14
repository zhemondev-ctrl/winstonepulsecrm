import { describe, expect, it } from "vitest";
import { requestedOperatorEmail, requireProvisioningPin } from "@/lib/it-operator-provisioning";

describe("Requested IT provisioning boundaries", () => {
  it.each(["fmnafis11@gmail.com", "trendfluxos@gmail.com", "zhemon.dev@gmail.com"])("allows only the requested identity %s", email => {
    expect(requestedOperatorEmail(email)).toBe(email);
  });
  it("rejects an unrequested Gmail", () => { expect(() => requestedOperatorEmail("another@gmail.com")).toThrow(); });
  it("normalizes email matching", () => { expect(requestedOperatorEmail(" FMNAFIS11@gmail.com ")).toBe("fmnafis11@gmail.com"); });
  it("allows full IT PIN only", () => { expect(() => requireProvisioningPin("full")).not.toThrow(); });
  it.each([null, "hq", "leadhub"])("denies other PIN scope %s", scope => { expect(() => requireProvisioningPin(scope)).toThrow(); });
});