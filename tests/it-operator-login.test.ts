import { describe, expect, it, vi } from "vitest";
import { verifyItOperator, type OperatorAccount } from "@/lib/it-operator-login";

const approved: OperatorAccount = { scope: "authority", readOnly: false, active: true, approval: "approved", profile: { role: "admin" } };
describe("IT Operator Google login preserves authority boundaries", () => {
  it("accepts active approved IT operators", async () => {
    const signOut = vi.fn();
    await verifyItOperator(async () => approved, signOut);
    expect(signOut).not.toHaveBeenCalled();
  });
  it.each([{ active: false }, { approval: "pending" }, { readOnly: true }, { scope: "agent", profile: { role: "agent" } }, { profile: null }])("rejects accounts without approved IT permission: %j", async patch => {
    const signOut = vi.fn();
    await expect(verifyItOperator(async () => ({ ...approved, ...patch }), signOut)).rejects.toThrow("IT Operator");
    expect(signOut).toHaveBeenCalledOnce();
  });
  it("fails closed on a server error", async () => {
    await expect(verifyItOperator(async () => { throw new Error("Unavailable"); }, vi.fn())).rejects.toThrow("Unavailable");
  });
});