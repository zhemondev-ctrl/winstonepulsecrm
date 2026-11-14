import { z } from "zod";
import { collectionPhone, CollectedLeadInput, COLLECTION_SETUP_MESSAGE, PERSONAL_LEAD_DAILY_LIMIT, LeadDraftFields as draftFieldsSchema, type CollectionOverview, type LeadDraftFields } from "./lead-collection";
import { dhakaDateOf } from "./business-day";

/** Narrow contract for prepared RPCs; generated schema is unchanged until authorised application. */
export type CollectionRpc = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;
};
export async function collectionDb(): Promise<CollectionRpc> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as CollectionRpc;
}
export async function collectionActor(mutation = false) {
  const { resolveWorkCaller, requireWrite } = await import("./access.server");
  const caller = await resolveWorkCaller(null);
  if (!caller.userId || !caller.profile || caller.scope === "none") throw new Error("Sign in to your approved staff account");
  if (mutation) {
    requireWrite(caller);
    await (await import("./agent-briefing.server")).assertBriefingForCaller(caller);
  }
  return caller.profile.id;
}
export function collectionError(error: { code?: string; message: string }): Error {
  if (["PGRST202", "42P01", "42883"].includes(error.code ?? "")) return new Error(COLLECTION_SETUP_MESSAGE);
  if (error.message.includes("Daily self lead cap")) return new Error("Daily personal lead limit reached. Choose a batch within your remaining allowance.");
  if (/Draft changed|stale revision/.test(error.message)) return new Error("This draft changed. Reopen the latest copy before saving.");
  if (error.message.includes("Submission key changed")) return new Error("This submission already has a different saved result. Reload before changing it.");
  return new Error("Your entry could not be saved. Nothing has been cleared; please retry.");
}
export async function readCollection(agentId: string, filters: { mode: string; query: string; from?: string | null | undefined; to?: string | null | undefined; offset: number }, db?: CollectionRpc): Promise<CollectionOverview> {
  const client = db ?? await collectionDb();
  const { data, error } = await client.rpc("read_agent_lead_collection", { _agent: agentId, _mode: filters.mode, _query: filters.query, _from: filters.from ?? null, _to: filters.to ?? null, _offset: filters.offset });
  if (error) {
    if (["PGRST202", "42P01", "42883"].includes(error.code ?? "")) return { ready: false, today: dhakaDateOf(), used: null, limit: PERSONAL_LEAD_DAILY_LIMIT, drafts: [], receipts: [], hasMore: false };
    throw new Error("Your collected leads are unavailable. Please refresh.");
  }
  // Responses contain no raw payload on failure; validate before entering browser state.
  return z.object({ ready: z.literal(true), today: z.string(), used: z.number().int().nonnegative(), limit: z.literal(10), hasMore: z.boolean(), drafts: z.array(z.object({ id: z.string().uuid(), revision: z.number().int(), updatedAt: z.string(), fields: draftFieldsSchema })), receipts: z.array(z.object({ id: z.string().uuid(), reference: z.string(), acceptedAt: z.string(), state: z.enum(["awaiting_leadhub", "assigned_to_me", "unavailable"]), lead: z.object({ id: z.string().uuid(), name: z.string().nullable(), phone: z.string().nullable(), status: z.string().nullable(), source: z.string().nullable() }).nullable() })) }).parse(data);
}

const SubmitResult = z.object({ results: z.array(z.object({ index: z.number().int(), status: z.enum(["accepted", "duplicate"]), receiptId: z.string().uuid().nullable() })), today: z.string(), used: z.number().int(), limit: z.literal(10) });
export async function submitCollection(agentId: string, requestKey: string, rows: LeadDraftFields[], draftId?: string | null, revision?: number | null, db?: CollectionRpc) {
  const client = db ?? await collectionDb();
  const clean = rows.map(row => {
    const parsed = CollectedLeadInput.parse(row);
    const phone = collectionPhone(parsed.phoneNumber);
    if (!phone) throw new Error("Enter a valid phone number");
    return { ...parsed, phoneNumber: phone.startsWith("880") ? phone : `+${phone}` };
  });
  const { data, error } = await client.rpc("submit_collected_leads_atomic", { _agent: agentId, _request: requestKey, _rows: clean, _draft: draftId ?? null, _revision: revision ?? null });
  if (error) throw collectionError(error);
  return SubmitResult.parse(data);
}