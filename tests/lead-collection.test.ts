import { describe, expect, it } from "vitest";
import { collectionPhone, CollectedLeadInput, emptyLeadDraft, personalLeadAllowance, receiptProjection, isCollectedOrigin } from "@/lib/lead-collection";
describe("personal lead collection rules", () => {
  it("requires a customer name and valid phone, not optional sales facts", () => {
    expect(CollectedLeadInput.safeParse({ ...emptyLeadDraft(), name: "", phoneNumber: "01712345678" }).success).toBe(false);
    expect(CollectedLeadInput.safeParse({ ...emptyLeadDraft(), name: "Customer", phoneNumber: "invalid" }).success).toBe(false);
    expect(CollectedLeadInput.safeParse({ ...emptyLeadDraft(), name: "Customer", phoneNumber: "01712345678" }).success).toBe(true);
  });
  it("normalises Bengali/Bangladesh digits and explicit international codes", () => {
    expect(collectionPhone("০১৭১২৩৪৫৬৭৮")).toBe("8801712345678");
    expect(collectionPhone("+8801712345678")).toBe("8801712345678");
    expect(collectionPhone("+44 7700 900123")).toBe("447700900123");
  });
  it("keeps a ten-lead personal allowance separate", () => {
    expect(personalLeadAllowance(0)).toBe(10); expect(personalLeadAllowance(9)).toBe(1); expect(personalLeadAllowance(10)).toBe(0);
  });
  it("LeadHub assignment never turns personal-origin work into mandatory company credit", () => {
    expect(isCollectedOrigin({ source: "agent_app", assignment_source: "leadhub" })).toBe(true);
    expect(isCollectedOrigin({ source: "lead_database", assignment_source: "leadhub" })).toBe(false);
    expect(isCollectedOrigin({ source: null, assignment_source: "self" })).toBe(true);
  });
  it("a transferred receipt never reveals customer fields or ID", () => {
    const result = receiptProjection({ id: "receipt", lead_id: "private", accepted_at: "2026-11-14T03:00:00Z" }, { id: "private", name: "Hidden", phone_number: "hidden", status: "pending", source: "agent_app", assigned_to: "other", assigned_agent_id: "other" }, "me");
    expect(result.state).toBe("unavailable"); expect(result.lead).toBeNull(); expect(JSON.stringify(result)).not.toContain("private");
  });
  it("conflicting ownership never becomes own or unassigned access", () => {
    const result = receiptProjection({ id: "receipt", lead_id: "private", accepted_at: "now" }, { id: "private", name: "Hidden", phone_number: "hidden", status: "pending", source: null, assigned_to: "me", assigned_agent_id: "other" }, "me");
    expect(result.state).toBe("unavailable"); expect(result.lead).toBeNull();
  });
});