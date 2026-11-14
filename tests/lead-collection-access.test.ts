import { beforeEach, describe, expect, it, vi } from "vitest";
const fx = vi.hoisted(() => ({ actor: { userId: "signed-in", profile: { id: "10000000-0000-4000-8000-000000000001" }, scope: "agent", readOnly: false }, resolve: vi.fn(), briefing: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/access.server", () => ({ resolveWorkCaller: (...args: unknown[]) => fx.resolve(...args), requireWrite: (caller: { readOnly: boolean }) => { if (caller.readOnly) throw new Error("read-only"); } }));
vi.mock("@/lib/agent-briefing.server", () => ({ assertBriefingForCaller: (...args: unknown[]) => fx.briefing(...args) }));
import { collectionActor, readCollection, submitCollection } from "@/lib/lead-collection.server";
import { emptyLeadDraft } from "@/lib/lead-collection";
beforeEach(() => { fx.resolve.mockReset().mockResolvedValue(fx.actor); fx.briefing.mockReset().mockResolvedValue(undefined); fx.rpc.mockReset(); });
describe("collection server boundary", () => {
  it("derives actor from verified own-work session, not saved PINs", async () => { expect(await collectionActor(true)).toBe(fx.actor.profile.id); expect(fx.resolve).toHaveBeenCalledWith(null); expect(fx.briefing).toHaveBeenCalledWith(fx.actor); });
  it("refuses PIN-only identity", async () => { fx.resolve.mockResolvedValue({ ...fx.actor,userId: null }); await expect(collectionActor(true)).rejects.toThrow("Sign in"); });
  it("refuses read-only HQ writes", async () => { fx.resolve.mockResolvedValue({ ...fx.actor,readOnly: true }); await expect(collectionActor(true)).rejects.toThrow("read-only"); });
  it("new mutations retain briefing enforcement", async () => { fx.briefing.mockRejectedValue(new Error("Daily briefing required")); await expect(collectionActor(true)).rejects.toThrow("Daily briefing"); });
  it("missing schema returns explicit unavailable totals, never zero or fallback writes", async () => {
    fx.rpc.mockResolvedValue({ data: null,error: { code: "PGRST202",message: "Missing" } });
    const result = await readCollection(fx.actor.profile.id,{ mode: "receipts",query: "",offset: 0 },{ rpc: fx.rpc }); expect(result.ready).toBe(false); expect(result.used).toBeNull();
    await expect(submitCollection(fx.actor.profile.id,"20000000-0000-4000-8000-000000000001",[{ ...emptyLeadDraft(),name: "Synthetic",phoneNumber: "01712345678" }],null,null,{ rpc: fx.rpc })).rejects.toThrow("not been saved");
    expect(fx.rpc.mock.calls.map(([name]) => name)).toEqual(["read_agent_lead_collection","submit_collected_leads_atomic"]);
  });
});