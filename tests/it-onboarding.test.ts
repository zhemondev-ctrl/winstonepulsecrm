import { beforeEach, describe, expect, it, vi } from "vitest";
import { canApproveOfficer, canReinviteOfficer, itManagerProblem, normalizeOfficerEmail, safeAppOrigin } from "@/lib/it-onboarding";

const m = vi.hoisted(() => ({
  pinScope: "full" as string | null,
  session: { scope: "authority", userId: "mgr-user", approval: "approved", readOnly: false, profile: { id: "mgr-profile", name: "Head", role: "admin", is_active: true } } as Record<string, unknown>,
  row: { id: "row-1", status: "password_set", user_id: "new-user" } as Record<string, unknown> | null,
  rpc: [] as Array<{ _action: string; _actor: string }>,
}));
vi.mock("@/lib/admin-gate.server", () => ({ adminTokenScope: () => m.pinScope }));
vi.mock("@/lib/access.server", () => ({
  resolveCaller: async () => m.session,
  requireAuthority: () => undefined,
  requireWrite: () => undefined,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: m.row }) }; return q; },
    rpc: async (_name: string, args: { _action: string; _actor: string }) => { m.rpc.push(args); return { error: null }; },
  },
}));
import { approveOfficer, requireItManager } from "@/lib/it-onboarding.server";

beforeEach(() => {
  m.pinScope = "full";
  m.session = { scope: "authority", userId: "mgr-user", approval: "approved", readOnly: false, profile: { id: "mgr-profile", name: "Head", role: "admin", is_active: true } };
  m.row = { id: "row-1", status: "password_set", user_id: "new-user" };
  m.rpc = [];
});

describe("new IT Operator rules", () => {
  it("needs the full IT PIN and a signed-in active IT Operator", () => {
    const ok = { pinScope: "full", signedInUserId: "u", role: "admin", active: true, approved: true };
    expect(itManagerProblem(ok)).toBeNull();
    expect(itManagerProblem({ ...ok, pinScope: "hq" })).not.toBeNull();
    expect(itManagerProblem({ ...ok, pinScope: null })).not.toBeNull();
    expect(itManagerProblem({ ...ok, signedInUserId: null })).not.toBeNull();
    expect(itManagerProblem({ ...ok, role: "agent" })).not.toBeNull();
    expect(itManagerProblem({ ...ok, active: false })).not.toBeNull();
  });
  it("approval only after the operator set their own password", () => {
    expect(canApproveOfficer("invited")).toBe(false);
    expect(canApproveOfficer("password_set")).toBe(true);
    expect(canApproveOfficer("active")).toBe(false);
    expect(canReinviteOfficer("failed")).toBe(true);
    expect(canReinviteOfficer("invited")).toBe(false);
  });
  it("emails are normalised and links only return to this app", () => {
    expect(normalizeOfficerEmail("  New.Op@Example.com ")).toBe("new.op@example.com");
    expect(normalizeOfficerEmail("not-an-email")).toBeNull();
    expect(safeAppOrigin("https://evil.example/x")).toBe("https://crm.winstonebd.com");
    expect(safeAppOrigin("https://crm.winstonebd.com/system")).toBe("https://crm.winstonebd.com");
  });
});

describe("approving a new IT Operator", () => {
  it("a PIN alone (no signed-in IT Operator) is refused", async () => {
    m.session = { scope: "authority", userId: null, approval: "approved", readOnly: false, profile: null };
    await expect(requireItManager("token")).rejects.toThrow();
  });
  it("an HQ viewing PIN is refused even when signed in", async () => {
    m.pinScope = "hq";
    await expect(approveOfficer({ adminToken: "t", id: "00000000-0000-0000-0000-000000000001" })).rejects.toThrow();
    expect(m.rpc).toEqual([]);
  });
  it("approves then grants, recorded against the signed-in operator", async () => {
    await approveOfficer({ adminToken: "t", id: "00000000-0000-0000-0000-000000000001" });
    expect(m.rpc.map((c) => c._action)).toEqual(["approve", "assign_role"]);
    expect(m.rpc.every((c) => c._actor === "mgr-user")).toBe(true);
  });
  it("refuses before the password is set, and refuses self-approval", async () => {
    m.row = { id: "row-1", status: "invited", user_id: "new-user" };
    await expect(approveOfficer({ adminToken: "t", id: "00000000-0000-0000-0000-000000000001" })).rejects.toThrow("পাসওয়ার্ড");
    m.row = { id: "row-1", status: "password_set", user_id: "mgr-user" };
    await expect(approveOfficer({ adminToken: "t", id: "00000000-0000-0000-0000-000000000001" })).rejects.toThrow("নিজেকে");
    expect(m.rpc).toEqual([]);
  });
});
