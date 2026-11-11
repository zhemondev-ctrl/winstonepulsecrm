import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { MAX_MEETING_ITEMS, MEETING_DECISIONS, canFinalize, decisionNeedsComment } from "@/lib/meeting-approvals";

const Token = z.object({ adminToken: z.string().nullable().optional() });
const Id = z.string().uuid();

async function scopeOf(token: string | null | undefined) {
  const { adminTokenScope } = await import("@/lib/admin-gate.server");
  return adminTokenScope(token ?? null);
}

/** HQ and IT may read; nobody else. */
async function requireReader(token: string | null | undefined) {
  const { resolveCaller } = await import("@/lib/access.server");
  const caller = await resolveCaller(token ?? null);
  if (caller.scope !== "authority") throw new Error("Executive HQ or IT access required");
  return scopeOf(token);
}

async function requireIt(token: string | null | undefined) {
  if ((await scopeOf(token)) !== "full") throw new Error("Only the IT Console can do this");
}

async function requireHq(token: string | null | undefined) {
  if ((await scopeOf(token)) !== "hq") throw new Error("Only Executive HQ (HQ PIN) can decide — IT cannot");
}

async function db() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function addEvent(row: { request_id: string; item_id?: string | null; action: string; actor: string; note?: string | null; details?: Record<string, unknown> }) {
  const sb = await db();
  const { error } = await sb.from("meeting_approval_events").insert({ ...row, item_id: row.item_id ?? null, note: row.note ?? null, details: (row.details ?? {}) as never });
  if (error) throw new Error("Could not save the history log");
}

export const listMeetingApprovals = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => Token.parse(v))
  .handler(async ({ data }) => {
    const scope = await requireReader(data.adminToken);
    const sb = await db();
    const { data: requests, error } = await sb
      .from("meeting_approval_requests")
      .select("id, title, meeting_date, status, created_at, first_opened_at, finalized_at, final_signer")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Meeting approvals unavailable");
    const ids = (requests ?? []).map((r) => r.id);
    const { data: items, error: itemErr } = ids.length
      ? await sb.from("meeting_approval_items").select("request_id, decision").in("request_id", ids)
      : { data: [], error: null };
    if (itemErr) throw new Error("Meeting approvals unavailable");
    const counts = new Map<string, { total: number; decided: number }>();
    for (const i of items ?? []) {
      const c = counts.get(i.request_id) ?? { total: 0, decided: 0 };
      c.total += 1;
      if (i.decision !== "pending") c.decided += 1;
      counts.set(i.request_id, c);
    }
    return {
      canCreate: scope === "full",
      canDecide: scope === "hq",
      requests: (requests ?? []).map((r) => ({ ...r, ...(counts.get(r.id) ?? { total: 0, decided: 0 }) })),
    };
  });

export const getMeetingApproval = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => Token.extend({ id: Id }).parse(v))
  .handler(async ({ data }) => {
    const scope = await requireReader(data.adminToken);
    const sb = await db();
    const { data: request, error } = await sb.from("meeting_approval_requests").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error("Meeting approval unavailable");
    if (!request) throw new Error("Meeting approval not found");
    if (scope === "hq" && !request.first_opened_at) {
      const at = new Date().toISOString();
      const { data: claimed } = await sb.from("meeting_approval_requests").update({ first_opened_at: at }).eq("id", request.id).is("first_opened_at", null).select("id");
      if (claimed?.length) {
        await addEvent({ request_id: request.id, action: "opened", actor: "Executive HQ" });
        request.first_opened_at = at;
      }
    }
    const [{ data: items, error: iErr }, { data: events, error: eErr }] = await Promise.all([
      sb.from("meeting_approval_items").select("*").eq("request_id", request.id).order("position"),
      sb.from("meeting_approval_events").select("id, item_id, action, actor, note, details, created_at").eq("request_id", request.id).order("created_at"),
    ]);
    if (iErr || eErr) throw new Error("Meeting approval unavailable");
    return { canDecide: scope === "hq" && request.status === "awaiting", canManage: scope === "full", request, items: items ?? [], events: events ?? [] };
  });

const CreateInput = Token.extend({
  title: z.string().trim().min(3).max(200),
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendees: z.string().trim().max(1000).optional(),
  summary: z.string().trim().min(1).max(10000),
  items: z.array(z.object({ title: z.string().trim().min(2).max(300), detail: z.string().trim().max(3000).optional() })).min(1).max(MAX_MEETING_ITEMS),
});

export const createMeetingApproval = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => CreateInput.parse(v))
  .handler(async ({ data }) => {
    await requireIt(data.adminToken);
    const sb = await db();
    const { data: row, error } = await sb
      .from("meeting_approval_requests")
      .insert({ title: data.title, meeting_date: data.meetingDate, attendees: data.attendees || null, summary: data.summary, created_by: "IT Console" })
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not create the approval request");
    const { error: itemErr } = await sb.from("meeting_approval_items").insert(
      data.items.map((it, idx) => ({ request_id: row.id, position: idx + 1, title: it.title, detail: it.detail || null })),
    );
    if (itemErr) {
      await sb.from("meeting_approval_requests").update({ status: "withdrawn", withdrawn_reason: "Items failed to save", withdrawn_at: new Date().toISOString() }).eq("id", row.id);
      throw new Error("Could not save the approval items");
    }
    await addEvent({ request_id: row.id, action: "created", actor: "IT Console", details: { items: data.items.length } });
    return { id: row.id };
  });

export const logMeetingLinkShared = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => Token.extend({ id: Id, via: z.enum(["copy", "whatsapp"]) }).parse(v))
  .handler(async ({ data }) => {
    await requireIt(data.adminToken);
    await addEvent({ request_id: data.id, action: "link_shared", actor: "IT Console", details: { via: data.via } });
    return { ok: true };
  });

export const decideMeetingItem = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) =>
    Token.extend({ itemId: Id, decision: z.enum(MEETING_DECISIONS), comment: z.string().trim().max(2000).optional() }).parse(v),
  )
  .handler(async ({ data }) => {
    await requireHq(data.adminToken);
    if (decisionNeedsComment(data.decision) && !data.comment) throw new Error("Add a comment explaining the change or rejection");
    const sb = await db();
    const { data: item, error } = await sb.from("meeting_approval_items").select("id, request_id, decision").eq("id", data.itemId).maybeSingle();
    if (error || !item) throw new Error("Item not found");
    const at = new Date().toISOString();
    const { error: upErr } = await sb
      .from("meeting_approval_items")
      .update({ decision: data.decision, decision_comment: data.comment || null, decided_by: "Executive HQ", decided_at: at })
      .eq("id", item.id);
    if (upErr) throw new Error(upErr.message.includes("closed") ? "This approval is already closed" : "Could not save the decision");
    await addEvent({ request_id: item.request_id, item_id: item.id, action: "item_decided", actor: "Executive HQ", note: data.comment || null, details: { from: item.decision, to: data.decision } });
    return { ok: true };
  });

export const finalizeMeetingApproval = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => Token.extend({ id: Id, signer: z.string().trim().min(2).max(120), note: z.string().trim().max(2000).optional() }).parse(v))
  .handler(async ({ data }) => {
    await requireHq(data.adminToken);
    const sb = await db();
    const { data: items, error } = await sb.from("meeting_approval_items").select("decision").eq("request_id", data.id);
    if (error) throw new Error("Meeting approval unavailable");
    if (!canFinalize((items ?? []) as { decision: "pending" }[])) throw new Error("Decide every item before submitting");
    const { data: done, error: upErr } = await sb
      .from("meeting_approval_requests")
      .update({ status: "decided", final_signer: data.signer, final_note: data.note || null, finalized_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "awaiting")
      .select("id");
    if (upErr || !done?.length) throw new Error("This approval is already closed");
    await addEvent({ request_id: data.id, action: "finalized", actor: `Executive HQ · ${data.signer}`, note: data.note || null });
    return { ok: true };
  });

export const withdrawMeetingApproval = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => Token.extend({ id: Id, reason: z.string().trim().min(3).max(1000) }).parse(v))
  .handler(async ({ data }) => {
    await requireIt(data.adminToken);
    const sb = await db();
    const { data: done, error } = await sb
      .from("meeting_approval_requests")
      .update({ status: "withdrawn", withdrawn_reason: data.reason, withdrawn_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "awaiting")
      .select("id");
    if (error || !done?.length) throw new Error("Only an open approval can be withdrawn");
    await addEvent({ request_id: data.id, action: "withdrawn", actor: "IT Console", note: data.reason });
    return { ok: true };
  });
