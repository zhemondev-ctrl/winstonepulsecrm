import { describe, expect, it } from "vitest";
import { visibleItStep } from "@/lib/access-navigation";

describe("IT access history cannot grant authority", () => {
  it("never opens operator login from a URL without verified PIN", () => {
    expect(visibleItStep("operator", false, false)).toBe("entry");
    expect(visibleItStep("password", false, true)).toBe("entry");
  });
  it("requires operator verification before showing password change", () => {
    expect(visibleItStep("password", true, false)).toBe("operator");
    expect(visibleItStep("password", true, true)).toBe("password");
  });
  it("supports backward and forward steps while verification is in memory", () => {
    expect([undefined, "pin", "operator", "password", "operator", "password"].map(step => visibleItStep(step, true, true))).toEqual(["entry", "pin", "operator", "password", "operator", "password"]);
  });
});