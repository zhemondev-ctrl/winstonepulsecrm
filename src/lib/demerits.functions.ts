import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Token = z.object({ adminToken: z.string().nullable().optional() });

/** HQ + IT read the permanent demerit log for one year. */
export const listAgentDemerits = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => Token.extend({ year: z.number().int().min(2026).max(2100) }).parse(v))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope !== "authority") throw new Error("Executive HQ or IT access required");
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    const canCancel = adminTokenScope(data.adminToken ?? null) === "hq";
    const { yearBounds } = await import("@/lib/demerits");
    const { from, to } = yearBounds(data.year);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: reviews, error } = await db
      .from("agent_accountability_reviews")
      .select("id, agent_id, business_date, pending_percent, status, agent:profiles!agent_accountability_reviews_agent_id_fkey(name)")
      .gte("business_date", from)
      .lte("business_date", to)
      .order("business_date", { ascending: false })
      .limit(5000);
    if (error) throw new Error("Demerit log unavailable");
    if ((reviews ?? []).length >= 5000) throw new Error("Demerit log truncated");
    const ids = (reviews ?? []).map((r) => r.id);
    const { data: cancels, error: cErr } = ids.length
      ? await db.from("agent_demerit_cancellations").select("review_id, reason, created_at").in("review_id", ids)
      : { data: [], error: null };
    if (cErr) throw new Error("Demerit log unavailable");
    const cancelBy = new Map((cancels ?? []).map((c) => [c.review_id, { reason: c.reason, at: c.created_at }]));
    return {
      canCancel,
      year: data.year,
      entries: (reviews ?? []).map((r) => ({
        reviewId: r.id,
        agentId: r.agent_id,
        agentName: (r.agent as { name?: string } | null)?.name ?? "—",
        businessDate: r.business_date,
        pendingPercent: Number(r.pending_percent),
        status: r.status as string,
        cancelled: cancelBy.get(r.id) ?? null,
      })),
    };
  });

/** Executive HQ only (HQ PIN): cancel one demerit point, once, with a reason. */
export const cancelAgentDemerit = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => Token.extend({ reviewId: z.string().uuid(), reason: z.string().trim().min(5).max(1000) }).parse(v))
  .handler(async ({ data }) => {
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    if (adminTokenScope(data.adminToken ?? null) !== "hq") throw new Error("Only Executive HQ (HQ PIN) can cancel a demerit — IT cannot");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: review, error } = await db.from("agent_accountability_reviews").select("id, agent_id, business_date").eq("id", data.reviewId).maybeSingle();
    if (error || !review) throw new Error("Demerit not found");
    const { error: insErr } = await db.from("agent_demerit_cancellations").insert({ review_id: review.id, reason: data.reason, cancelled_by: "Executive HQ" });
    if (insErr) throw new Error(insErr.code === "23505" ? "This demerit was already cancelled" : "Could not cancel the demerit");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({ action: "demerit_cancelled", entityType: "agent_accountability_review", entityId: review.id, actorLabel: "Executive HQ", metadata: { agent_id: review.agent_id, business_date: review.business_date, reason: data.reason } });
    return { ok: true };
  });
