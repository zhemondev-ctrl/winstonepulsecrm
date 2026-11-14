import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ scope: "agent", readOnly: true }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const chain = { inputValidator: () => chain, handler: (fn: unknown) => fn }; return chain; } }));
vi.mock("@/lib/access.server", () => ({ resolveCaller: async () => state, requireAuthority: (caller: typeof state) => { if (caller.scope !== "authority") throw new Error("Authority required"); } }));
import { readSecurityHistory } from "@/lib/security-history.functions";
const run = () => (readSecurityHistory as unknown as (arg: unknown) => Promise<unknown>)({ data: { adminToken: null } });
for (const scope of ["agent", "coordinator", "none"]) it(`rejects ${scope} history reads server-side`, async () => { state.scope = scope; await expect(run()).rejects.toThrow("Authority required"); });
it("allows read-only HQ authority to compare evidence without write privileges", async () => { state.scope = "authority"; state.readOnly = true; await expect(run()).resolves.toHaveLength(4); });