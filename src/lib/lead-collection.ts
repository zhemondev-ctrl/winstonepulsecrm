import { z } from "zod";
import { normalizeBangladeshPhone } from "./lead-phone";

export const PERSONAL_LEAD_DAILY_LIMIT = 10;
export const COLLECTION_SETUP_MESSAGE = "Lead collection is awaiting secure setup. Your entry has not been saved.";

/** Personal origin survives LeadHub assignment; assignment is not provenance. */
export function isCollectedOrigin(row: { source?: string | null; assignment_source?: string | null }) {
  return row.source === "agent_app" || row.assignment_source === "self";
}

export function collectionPhone(raw: string): string | null {
  const ascii = raw.replace(/[০-৯]/g, digit => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));
  return normalizeBangladeshPhone(ascii);
}

export const LeadDraftFields = z.object({
  name: z.string().max(120).default(""),
  phoneNumber: z.string().max(40).default(""),
  company: z.string().max(120).default(""),
  address: z.string().max(300).default(""),
  referenceBy: z.string().max(120).default(""),
  serialNo: z.string().max(40).default(""),
  notes: z.string().max(2000).default(""),
});
export type LeadDraftFields = z.infer<typeof LeadDraftFields>;
export const emptyLeadDraft = (): LeadDraftFields => LeadDraftFields.parse({});
export const CollectedLeadInput = LeadDraftFields.extend({
  name: z.string().trim().min(1).max(120),
  phoneNumber: z.string().trim().max(40).refine(raw => collectionPhone(raw) !== null, "Enter a valid phone number; include +country code for international numbers"),
});

export type CollectionReceipt = {
  id: string; reference: string; acceptedAt: string;
  state: "awaiting_leadhub" | "assigned_to_me" | "unavailable";
  lead: { id: string; name: string | null; phone: string | null; status: string | null; source: string | null } | null;
};
export type CollectionDraft = { id: string; revision: number; updatedAt: string; fields: LeadDraftFields };
export type CollectionOverview = {
  ready: boolean; today: string; used: number | null; limit: number;
  drafts: CollectionDraft[]; receipts: CollectionReceipt[]; hasMore: boolean;
};

/** A receipt never grants access to a customer owned elsewhere. */
export function receiptProjection(row: { id: string; lead_id: string; accepted_at: string }, lead: {
  id: string; name: string | null; phone_number: string | null; status: string | null; source: string | null;
  assigned_to: string | null; assigned_agent_id: string | null;
} | undefined, agentId: string): CollectionReceipt {
  const conflict = Boolean(lead?.assigned_to && lead.assigned_agent_id && lead.assigned_to !== lead.assigned_agent_id);
  const owner = conflict ? null : lead?.assigned_to ?? lead?.assigned_agent_id ?? null;
  const own = Boolean(lead) && !conflict && owner === agentId;
  return {
    id: row.id, reference: `LC-${row.id.slice(0, 8).toUpperCase()}`, acceptedAt: row.accepted_at,
    state: own ? "assigned_to_me" : lead && !conflict && !owner ? "awaiting_leadhub" : "unavailable",
    lead: own && lead ? { id: lead.id, name: lead.name, phone: lead.phone_number, status: lead.status, source: lead.source } : null,
  };
}

export function personalLeadAllowance(used: number) {
  return Math.max(0, PERSONAL_LEAD_DAILY_LIMIT - Math.max(0, used));
}