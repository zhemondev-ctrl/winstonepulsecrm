import { describe, expect, it } from "vitest";
import { summarizeAgents, isQualified, maskPhone } from "@/lib/agent-self-leads";
const row = (agentId: string, temperature: string | null) => ({ id: Math.random().toString(), name: "x", phone: null, agentId, status: "pending", createdAt: "2026-11-12T00:00:00Z", lastOutcome: null, temperature, followUps: 0 });
describe("agent own leads", () => {
  it("counts only Hot/Warm own leads as qualified", () => {
    expect(isQualified("Hot")).toBe(true); expect(isQualified("warm")).toBe(true); expect(isQualified("cold")).toBe(false);
    const [a] = summarizeAgents([row("a", "hot"), row("a", "cold"), row("a", null)], [], new Map([["a", "A"]]));
    expect(a).toMatchObject({ ownAdded: 3, ownQualified: 1 });
  });
  it("company task is complete only when all 50 are reported, regardless of own leads", () => {
    const own = Array.from({ length: 80 }, () => row("a", "hot"));
    const [a] = summarizeAgents(own, [{ agentId: "a", total: 50, done: 49 }], new Map());
    expect(a.companyComplete).toBe(false);
    expect(summarizeAgents([], [{ agentId: "a", total: 50, done: 50 }], new Map())[0].companyComplete).toBe(true);
  });
  it("masks phone numbers", () => { expect(maskPhone("01712345678")).toBe("017••••678"); });
});
