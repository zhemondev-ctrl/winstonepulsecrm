import { MAX_DAILY_LEADS_PER_AGENT } from "@/lib/lead-quota";
import { followUpWork } from "@/lib/follow-up-work.server";
import { isOpenFollowUp } from "@/lib/follow-up-lifecycle";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * The canonical lead database, reachable only through LeadHub Nexus.
 * The real work (duplicate protection, batched hand-out, shortage alert)
 * lives in lead-pool.server.ts.
 */

const TokenInput = z.object({ adminToken: z.string().nullable().optional() });

async function dispatcher(adminToken: string | null | undefined) {
  const { requireLeadHub } = await import("@/lib/access.server");
  await requireLeadHub(adminToken);
  return { label: "LeadHub Nexus" };
}

export type LeadPoolAgent = {
  id: string;
  name: string;
  total: number;
  pending: number;
  today: number;
};

/** Read access is restricted to the dedicated LeadHub PIN. */
async function deckReader(adminToken: string | null | undefined) {
  const { requireLeadHub } = await import("@/lib/access.server");
  await requireLeadHub(adminToken);
  return { label: "LeadHub Nexus" };
}

const HeadLeadInput = z.object({
  adminToken: z.string().nullable().optional(),
  name: z.string().trim().min(1, "নাম লিখুন").max(120),
  phoneNumber: z.string().trim().min(6, "মোবাইল নম্বর দিন").max(40),
  address: z.string().trim().max(300).nullable().optional(),
  company: z.string().trim().max(160).nullable().optional(),
  serialNo: z.string().trim().max(40).nullable().optional(),
  referenceBy: z.string().trim().min(1, "রেফারেন্স লিখুন").max(120),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type HeadLeadResult =
  | { ok: true; leadId: string }
  | {
      ok: false;
      reason: "duplicate" | "invalid_phone";
      message: string;
      existing?: undefined | {
        id: string;
        name: string;
        serialNo: string | null;
        referenceBy: string | null;
        status: string;
        agentName: string | null;
      };
    };

/**
 * Adds one lead to the HEAD DATABASE (unassigned pool) — never to the caller's
 * own queue. Duplicate protection and phone normalisation are server-side.
 */
export const addHeadLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => HeadLeadInput.parse(input))
  .handler(async ({ data }): Promise<HeadLeadResult> => {
    const caller = await deckReader(data.adminToken);
    const { intakeLead, InvalidLeadPhoneError } = await import("@/lib/lead-intake.server");
    const { HEAD_DATABASE_SOURCE } = await import("@/lib/head-lead");
    const actorLabel = caller.label;
    try {
      const result = await intakeLead({
        name: data.name,
        phoneNumber: data.phoneNumber,
        company: data.company ?? null,
        address: data.address ?? null,
        serialNo: data.serialNo ?? null,
        referenceBy: data.referenceBy,
        notes: data.notes ?? null,
        ownerId: null,
        source: HEAD_DATABASE_SOURCE,
        actorProfileId: null,
        actorLabel,
      });
      if (result.duplicate) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("leads")
          .select("id, name, serial_no, reference_by, status, assigned_to")
          .eq("id", result.leadId)
          .maybeSingle();
        let agentName: string | null = null;
        if (row?.assigned_to) {
          const { data: agent } = await supabaseAdmin
            .from("profiles")
            .select("name")
            .eq("id", row.assigned_to)
            .maybeSingle();
          agentName = agent?.name ?? null;
        }
        return {
          ok: false,
          reason: "duplicate",
          message: "এই নম্বর আগে থেকেই CRM-এ আছে — নতুন লিড তৈরি হয়নি",
          existing: row
            ? {
                id: row.id,
                name: row.name,
                serialNo: row.serial_no,
                referenceBy: row.reference_by,
                status: row.status,
                agentName,
              }
            : undefined,
        };
      }
      return { ok: true, leadId: result.leadId };
    } catch (err) {
      if (err instanceof InvalidLeadPhoneError) {
        return { ok: false, reason: "invalid_phone", message: err.message };
      }
      throw err;
    }
  });

const SearchInput = z.object({
  adminToken: z.string().nullable().optional(),
  q: z.string().trim().max(80).optional(),
  agentId: z.string().uuid().nullable().optional(),
  status: z.enum(["pending", "contacted", "follow_up", "closed"]).nullable().optional(),
  source: z.string().trim().max(40).nullable().optional(),
  scope: z.enum(["pool", "all"]).default("pool"),
});

/** Lead search across the deck: reference, serial, phone or name, plus filters. */
export const searchDeckLeads = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data }) => {
    const caller = await deckReader(data.adminToken);
    const scope = data.scope;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("leads")
      .select(
        "id, name, phone_number, serial_no, reference_by, source, status, assigned_to, assignment_source, address, company, created_at, work_date",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (scope === "pool") {
      query = query
        .is("assigned_to", null)
        .or("assignment_source.is.null,assignment_source.neq.duplicate_skipped");
    } else if (data.agentId) {
      query = query.eq("assigned_to", data.agentId);
    }
    if (data.status) query = query.eq("status", data.status);
    if (data.source) query = query.eq("source", data.source);
    const q = data.q?.replace(/[,()*%]/g, " ").trim();
    if (q) {
      const digits = q.replace(/\D/g, "");
      const parts = [
        `reference_by.ilike.%${q}%`,
        `serial_no.ilike.%${q}%`,
        `name.ilike.%${q}%`,
      ];
      if (digits.length >= 4) parts.push(`phone_number.ilike.%${digits.slice(-10)}%`);
      query = query.or(parts.join(","));
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const ownerIds = [...new Set((rows ?? []).map((r) => r.assigned_to).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    if (ownerIds.length) {
      const { data: owners } = await supabaseAdmin.from("profiles").select("id, name").in("id", ownerIds);
      for (const o of owners ?? []) names.set(o.id, o.name);
    }
    return {
      scope,
      rows: (rows ?? []).map((r) => ({
        ...r,
        agentName: r.assigned_to ? (names.get(r.assigned_to) ?? null) : null,
      })),
    };
  });

/** What is in the database right now, and what each agent already holds. */
export const leadPoolStatus = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    await deckReader(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { dhakaToday, usablePoolCount, activeAgents, dailyPlan, assignedTodayByAgent } = await import(
      "@/lib/lead-pool.server"
    );
    const today = dhakaToday();

    const [poolCount, agents, plan, held, { data: previewCandidates }, { data: assigned }, { data: audits }] = await Promise.all([
      usablePoolCount(),
      activeAgents(),
      dailyPlan(),
      assignedTodayByAgent(today),
      supabaseAdmin
        .from("leads")
        .select("id, name, phone_number, serial_no, reference_by, created_at")
        .is("assigned_to", null)
        .or("assignment_source.is.null,assignment_source.neq.duplicate_skipped")
        .order("created_at", { ascending: true })
        .limit(100),
      supabaseAdmin
        .from("leads")
        .select("assigned_to, status, work_date")
        .not("assigned_to", "is", null)
        .limit(20000),
      supabaseAdmin
        .from("audit_logs")
        .select("created_at, metadata")
        .eq("action", "lead_imported")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    const { eligibleLeadIds } = await import("@/lib/lead-eligibility.server");
    const previewIds = new Set(
      await eligibleLeadIds((previewCandidates ?? []).map((lead) => lead.id)),
    );
    const preview = (previewCandidates ?? []).filter((lead) => previewIds.has(lead.id)).slice(0, 12);

    const rows = assigned ?? [];
    const rawImportMetadata = audits?.[0]?.metadata;
    const importMetadata =
      rawImportMetadata && typeof rawImportMetadata === "object" && !Array.isArray(rawImportMetadata)
        ? rawImportMetadata
        : null;
    const perAgent: LeadPoolAgent[] = agents.map((agent) => {
      const mine = rows.filter((row) => row.assigned_to === agent.id);
      return {
        id: agent.id,
        name: agent.name,
        total: mine.length,
        pending: mine.filter((row) => row.status === "pending").length,
        today: held.get(agent.id) ?? 0,
      };
    });

    const need = agents.length * plan.perAgent;
    return {
      today,
      poolCount,
      preview: preview ?? [],
      agents: perAgent,
      dailyPerAgent: plan.perAgent,
      lastRunDate: plan.lastRunDate,
      shortage: poolCount < need,
      neededForNextRound: Math.max(0, need - poolCount),
      daysLeft: need > 0 ? Math.floor(poolCount / need) : 0,
      latestImport:
        audits?.[0] && importMetadata
          ? {
              createdAt: audits[0].created_at,
              incoming: Number(importMetadata["incoming"] ?? 0),
              excludedAlreadyWorkedOrAssigned: Number(
                importMetadata["excludedAlreadyWorkedOrAssigned"] ?? 0,
              ),
              excludedDuplicate: Number(importMetadata["excludedDuplicate"] ?? 0),
              eligibleNew: Number(importMetadata["eligibleNew"] ?? 0),
            }
          : null,
    };
  });

const DistributeInput = z.object({
  adminToken: z.string().nullable().optional(),
  /** How many database leads each active agent should receive today. */
  perAgent: z.number().int().min(1).max(MAX_DAILY_LEADS_PER_AGENT),
  /** Also make this the amount the automatic daily run uses. */
  saveAsDaily: z.boolean().optional(),
  /** Desks to skip today — e.g. an account still waiting for HQ approval. */
  excludeEmployeeIds: z.array(z.string().trim().max(32)).max(20).optional(),
  /** Give everyone included exactly `perAgent`, ignoring lighter fixed quotas. */
  ignoreFixedQuota: z.boolean().optional(),
});

/** Hands the same number of database leads to every active agent. */
export const distributeLeadPool = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DistributeInput.parse(input))
  .handler(async ({ data }) => {
    const caller = await dispatcher(data.adminToken);

    const { distributeDailyLeads, saveDailyPlan, dhakaToday } = await import(
      "@/lib/lead-pool.server"
    );
    const result = await distributeDailyLeads({
      perAgent: data.perAgent,
      actorProfileId: null,
      actorLabel: caller.label,
      trigger: "manual",
      excludeEmployeeIds: data.excludeEmployeeIds,
      ignoreFixedQuota: data.ignoreFixedQuota,
    });
    if (data.saveAsDaily) await saveDailyPlan({ perAgent: data.perAgent });
    await saveDailyPlan({ perAgent: data.perAgent, lastRunDate: dhakaToday() });
    return result;
  });

/** Changes only the daily automatic amount, without handing leads out now. */
export const setDailyLeadPlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({ perAgent: z.number().int().min(1).max(MAX_DAILY_LEADS_PER_AGENT) }).parse(input),
  )
  .handler(async ({ data }) => {
    const caller = await dispatcher(data.adminToken);
    const { saveDailyPlan } = await import("@/lib/lead-pool.server");
    await saveDailyPlan({ perAgent: data.perAgent });
    return { perAgent: data.perAgent };
  });

const ExtraInput = z.object({
  adminToken: z.string().nullable().optional(),
  agentProfileId: z.string().uuid(),
  quantity: z.number().int().min(1).max(200),
  reason: z.string().trim().max(300).nullable().optional(),
});

/**
 * Extra leads above the base quota — available from the IT Console and the
 * Coordinator Deck. The person's default daily quota is not changed.
 */
export const grantExtraLeadPool = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ExtraInput.parse(input))
  .handler(async ({ data }) => {
    const caller = await dispatcher(data.adminToken);
    const { grantExtraLeads } = await import("@/lib/lead-pool.server");
    return grantExtraLeads({
      agentProfileId: data.agentProfileId,
      quantity: data.quantity,
      reason: data.reason ?? null,
      actorProfileId: null,
      actorLabel: caller.label,
    });
  });

/** Base quota vs extra leads for today, per agent. */
export const quotaOverview = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    await deckReader(data.adminToken);
    const { activeAgents, dailyPlan, extraGrantsToday, dhakaToday, agentDailyTargets } = await import(
      "@/lib/lead-pool.server"
    );
    const { quotaFor } = await import("@/lib/lead-quota");
    const [agents, plan, extra, targets] = await Promise.all([
      activeAgents(),
      dailyPlan(),
      extraGrantsToday(),
      agentDailyTargets(dhakaToday()),
    ]);
    return {
      workDate: dhakaToday(),
      floorQuota: plan.perAgent,
      rows: agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        employeeId: agent.employee_id ?? null,
        baseQuota: Math.min(MAX_DAILY_LEADS_PER_AGENT, targets.get(agent.id) ?? quotaFor(agent.employee_id, plan.perAgent)),
        extraToday: extra[agent.id] ?? 0,
      })),
    };
  });

// ─── HEAD LEAD STORE ────────────────────────────────────────────────────────

/** Exported for tests: the store listing input (page size capped at 500, not the 50/day assignment cap). */
export const StoreInput = z.object({
  adminToken: z.string().nullable().optional(),
  q: z.string().trim().max(80).optional(),
  assignment: z.enum(["all", "unassigned", "assigned", "duplicate"]).default("all"),
  agentId: z.string().uuid().nullable().optional(),
  status: z.enum(["pending", "contacted", "follow_up", "closed"]).nullable().optional(),
  source: z.string().trim().max(60).nullable().optional(),
  temperature: z.string().trim().max(20).nullable().optional(),
  quality: z.enum(["any", "missing_reference", "invalid_phone"]).default("any"),
  // Read-only listing page size (NOT the 50/day assignment cap).
  limit: z.number().int().min(1).max(500).default(200),
});

const BD_MOBILE = /^(?:\+?88)?01[3-9]\d{8}$/;

/**
 * Master Lead Store: every lead, permanently. Coordinator/authority see the
 * whole store; the Sell Team Admin (intake) sees the unassigned pool only.
 * Agents are refused server-side.
 */
export const listLeadStore = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => StoreInput.parse(input))
  .handler(async ({ data }) => {
    await deckReader(data.adminToken);
    const assignment = data.assignment;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("leads")
      .select(
        "id, serial_no, name, phone_number, address, company, notes, reference_by, source, status, temperature, grade, outcome_category, assigned_to, assignment_source, work_date, last_call_at, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (assignment === "unassigned") {
      query = query
        .is("assigned_to", null)
        .or("assignment_source.is.null,assignment_source.neq.duplicate_skipped");
    } else if (assignment === "assigned") {
      query = query.not("assigned_to", "is", null);
    } else if (assignment === "duplicate") {
      query = query.eq("assignment_source", "duplicate_skipped");
    }
    if (data.agentId) query = query.eq("assigned_to", data.agentId);
    if (data.status) query = query.eq("status", data.status);
    if (data.source) query = query.eq("source", data.source);
    if (data.temperature) query = query.ilike("temperature", data.temperature);
    if (data.quality === "missing_reference") query = query.or("reference_by.is.null,reference_by.eq.");
    const q = data.q?.replace(/[,()*%]/g, " ").trim();
    if (q) {
      const digits = q.replace(/\D/g, "");
      const parts = [
        `reference_by.ilike.%${q}%`,
        `serial_no.ilike.%${q}%`,
        `name.ilike.%${q}%`,
        `company.ilike.%${q}%`,
      ];
      if (digits.length >= 4) parts.push(`phone_number.ilike.%${digits.slice(-10)}%`);
      query = query.or(parts.join(","));
    }
    const { data: rows, error, count } = await query;
    if (error) throw new Error(error.message);
    let list = rows ?? [];
    if (data.quality === "invalid_phone") {
      list = list.filter((r) => !BD_MOBILE.test(r.phone_number.replace(/[\s-]/g, "")));
    }
    const ids = list.map((r) => r.id);
    const ownerIds = [...new Set(list.map((r) => r.assigned_to).filter(Boolean))] as string[];
    const [owners, follows] = await Promise.all([
      ownerIds.length
        ? supabaseAdmin.from("profiles").select("id, name, employee_id").in("id", ownerIds)
        : Promise.resolve({ data: [] as { id: string; name: string; employee_id: string | null }[] }),
      ids.length
        ? followUpWork(supabaseAdmin)
            .select("lead_id, scheduled_at, status")
            .in("lead_id", ids)
            .order("scheduled_at", { ascending: true })
        : Promise.resolve({ data: [] as { lead_id: string; scheduled_at: string; status: string }[] }),
    ]);
    const names = new Map((owners.data ?? []).map((o) => [o.id, o.name]));
    const nextFollow = new Map<string, string>();
    for (const f of (follows.data ?? []) as { lead_id: string; scheduled_at: string; status: string }[]) {
      if (isOpenFollowUp(f.status) && !nextFollow.has(f.lead_id)) nextFollow.set(f.lead_id, f.scheduled_at);
    }
    return {
      full: true,
      total: count ?? list.length,
      rows: list.map((r) => ({
        ...r,
        agentName: r.assigned_to ? (names.get(r.assigned_to) ?? null) : null,
        nextFollowUp: nextFollow.get(r.id) ?? null,
        duplicate: r.assignment_source === "duplicate_skipped",
        invalidPhone: !BD_MOBILE.test(r.phone_number.replace(/[\s-]/g, "")),
      })),
    };
  });

/** Coordinator Deck dashboard numbers — live counts, never demo values. */
export const deckKpis = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    await deckReader(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { dhakaToday, usablePoolCount, activeAgents, dailyPlan } = await import(
      "@/lib/lead-pool.server"
    );
    const today = dhakaToday();
    const head = () => supabaseAdmin.from("leads").select("id", { count: "exact", head: true });
    const [total, unassigned, assignedToday, duplicate, missingRef, ready, agents, plan, assignedAll] =
      await Promise.all([
        head(),
        head()
          .is("assigned_to", null)
          .or("assignment_source.is.null,assignment_source.neq.duplicate_skipped"),
        head().not("assigned_to", "is", null).eq("work_date", today),
        head().eq("assignment_source", "duplicate_skipped"),
        head().or("reference_by.is.null,reference_by.eq."),
        usablePoolCount(),
        activeAgents(),
        dailyPlan(),
        head().not("assigned_to", "is", null),
      ]);
    // Invalid phones: scan unassigned rows only (bounded).
    const { data: phones } = await supabaseAdmin
      .from("leads")
      .select("phone_number")
      .is("assigned_to", null)
      .limit(5000);
    const invalid = (phones ?? []).filter(
      (r) => !BD_MOBILE.test(r.phone_number.replace(/[\s-]/g, "")),
    ).length;
    return {
      today,
      totalStore: total.count ?? 0,
      unassigned: unassigned.count ?? 0,
      assigned: assignedAll.count ?? 0,
      readyToday: ready,
      assignedToday: assignedToday.count ?? 0,
      duplicate: duplicate.count ?? 0,
      invalid,
      missingData: missingRef.count ?? 0,
      availableAgents: agents.length,
      perAgent: plan.perAgent,
      neededToday: agents.length * plan.perAgent,
    };
  });

const ManualAssignInput = z.object({
  adminToken: z.string().nullable().optional(),
  agentId: z.string().uuid(),
  leadIds: z.array(z.string().uuid()).min(1).max(200),
});

/**
 * Manual assignment of selected Lead Store rows to one active approved agent.
 * Only unassigned, eligible, non-duplicate rows move; each move is atomic
 * (assigned_to IS NULL guard) so a lead can never reach two agents.
 */
export const assignSelectedLeads = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ManualAssignInput.parse(input))
  .handler(async ({ data }) => {
    const caller = await dispatcher(data.adminToken);
    const { assertDistributionDay } = await import("@/lib/business-day");
    assertDistributionDay();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { activeAgents, dhakaToday } = await import("@/lib/lead-pool.server");
    const agent = (await activeAgents()).find((a) => a.id === data.agentId);
    if (!agent) throw new Error("এই এজেন্ট সক্রিয়/অনুমোদিত নয়");

    const { data: candidates, error } = await supabaseAdmin
      .from("leads")
      .select("id, assignment_source")
      .in("id", data.leadIds)
      .is("assigned_to", null);
    if (error) throw new Error(error.message);
    const open = (candidates ?? []).filter((l) => l.assignment_source !== "duplicate_skipped");
    const { eligibleLeadIds } = await import("@/lib/lead-eligibility.server");
    const eligible = new Set(await eligibleLeadIds(open.map((l) => l.id)));
    const ids = open.filter((l) => eligible.has(l.id)).map((l) => l.id);
    if (!ids.length) return { assigned: 0, skipped: data.leadIds.length };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("leads")
      .update({
        assigned_to: agent.id,
        assigned_agent_id: agent.id,
        assignment_source: "leadhub",
        work_date: dhakaToday(),
      })
      .in("id", ids)
      .is("assigned_to", null)
      .is("assigned_agent_id", null)
      .select("id");
    if (updateError) throw new Error(updateError.message);
    const moved = (updated ?? []).map((r) => r.id);
    if (moved.length) {
      await supabaseAdmin.from("lead_assignments").insert(
        moved.map((id) => ({ lead_id: id, from_agent_id: null, to_agent_id: agent.id, source: "leadhub_manual" })),
      );
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit({
        action: "lead_assigned",
        entityType: "lead",
        entityId: null,
        actorProfileId: null,
        actorLabel: caller.label ?? "LeadHub Nexus",
        metadata: { agentId: agent.id, count: moved.length, source: "leadhub_manual", leadIds: moved },
      });
    }
    return { assigned: moved.length, skipped: data.leadIds.length - moved.length };
  });

/** Import batch history for the Coordinator Deck. */
export const importHistory = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    await deckReader(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("audit_logs")
      .select("id, created_at, actor_label, metadata")
      .eq("action", "lead_imported")
      .order("created_at", { ascending: false })
      .limit(30);
    return (rows ?? []).map((r) => {
      const m = (r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? r.metadata : {}) as Record<string, unknown>;
      return {
        id: r.id,
        createdAt: r.created_at,
        actor: r.actor_label,
        incoming: Number(m["incoming"] ?? 0),
        imported: Number(m["eligibleNew"] ?? 0),
        duplicates: Number(m["excludedDuplicate"] ?? 0),
        alreadyWorked: Number(m["excludedAlreadyWorkedOrAssigned"] ?? 0),
      };
    });
  });

/**
 * LeadHub, read-only: what the next automatic distribution would hand each desk
 * if it ran now. Nothing is assigned, parked or saved.
 */
export const previewDailyDistribution = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.extend({ target: z.enum(["auto", "today", "next", "date"]).default("auto"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(input))
  .handler(async ({ data }) => {
    await deckReader(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lp = await import("@/lib/lead-pool.server");
    const { isDistributionDay, nextBusinessDay } = await import("@/lib/business-day");
    const { BACKLOG_CAP_CONFIG_ID, AUTO_PAUSE_CONFIG_ID, readBacklogCap, isAutoDistributionPaused } = await import("@/lib/backlog-cap");
    const { quotaFor } = await import("@/lib/lead-quota");
    const { planDistributionPreview } = await import("@/lib/distribution-preview");

    const today = lp.dhakaToday();
    const plan = await lp.dailyPlan();
    const pauseSetting = await supabaseAdmin.from("app_config").select("data").eq("id", AUTO_PAUSE_CONFIG_ID).maybeSingle();
    if (pauseSetting.error) throw new Error("Distribution settings unavailable");
    const pausedOn = (d: string) => isAutoDistributionPaused(d, pauseSetting.data?.data ?? null);
    // "auto" = the morning run that will actually hand out leads next: today if it
    // has not run yet, else the next open day that is not paused.
    let target: "today" | "next" = data.target === "today" ? "today" : "next";
    let day = target === "today" ? today : nextBusinessDay(today);
    if (data.target === "auto") {
      if (plan.lastRunDate !== today && isDistributionDay(today) && !pausedOn(today)) {
        target = "today";
        day = today;
      } else {
        for (let i = 0; i < 14 && pausedOn(day); i++) day = nextBusinessDay(day);
      }
    }
    if (data.target === "date") {
      if (!data.date || data.date < today) throw new Error("Pick today or a future date");
      const limit = new Date(`${today}T00:00:00Z`); limit.setUTCDate(limit.getUTCDate() + 30);
      if (data.date > limit.toISOString().slice(0, 10)) throw new Error("Pick a date within 30 days");
      day = data.date;
      target = data.date === today ? "today" : "next";
    }
    const skippedPaused = data.target === "auto" && target === "next" && day !== nextBusinessDay(today);
    const agents = await lp.activeAgents();
    const ids = agents.map((a) => a.id);
    const [targets, held, backlog, pool, capRow, locks] = await Promise.all([
      lp.agentDailyTargets(day),
      lp.assignedTodayByAgent(day),
      ids.length ? lp.pendingBacklogByAgent(ids, day) : Promise.resolve(new Map<string, number>()),
      lp.usablePoolCount(),
      supabaseAdmin.from("app_config").select("data").eq("id", BACKLOG_CAP_CONFIG_ID).maybeSingle(),
      ids.length
        ? supabaseAdmin.from("agent_accountability_reviews").select("agent_id,updated_at").in("agent_id", ids).neq("status", "approved").lte("unlock_for_date", day)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (capRow.error || locks.error) throw new Error("Distribution settings unavailable");
    const cap = readBacklogCap(capRow.data?.data);
    const lockedIds = new Set((locks.data ?? []).map((r) => r.agent_id));
    const result = planDistributionPreview({
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        quota: Math.min(MAX_DAILY_LEADS_PER_AGENT, targets.get(a.id) ?? quotaFor(a.employee_id, plan.perAgent)),
        held: held.get(a.id) ?? 0,
        backlog: backlog.get(a.id) ?? 0,
        locked: lockedIds.has(a.id),
      })),
      cap,
      pool,
      distributionDay: isDistributionDay(day),
      paused: pausedOn(day),
    });
    // Usage log for the dry-run comparison (counts only, no lead or agent data).
    const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
    const logged = await supabaseAdmin.from("distribution_preview_views").insert({ target_day: day, mode: data.target, weekday: wd, blocked: (result as { block?: string | null }).block ?? "none" });
    if (logged.error) console.error("dry-run usage log failed", logged.error.message);
    return {
      ...result,
      day,
      today,
      target,
      skippedPaused,
      perAgent: plan.perAgent,
      cap,
      alreadyRanToday: plan.lastRunDate === today,
      measuredAt: new Date().toISOString(),
      // Backlog is counted live at measuredAt; review locks carry their own last change time.
      locksUpdatedAt: (locks.data ?? []).reduce<string | null>((m, r) => { const u = (r as { updated_at?: string | null }).updated_at ?? null; return u && (!m || u > m) ? u : m; }, null),
    };
  });

/** LeadHub, read-only: who actually received leads from the morning run on a saved Dhaka day. */
export const readHandoutResults = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.extend({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input))
  .handler(async ({ data }) => {
    await deckReader(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lp = await import("@/lib/lead-pool.server");
    const { groupHandout } = await import("@/lib/handout-results");
    const start = new Date(`${data.date}T00:00:00+06:00`).toISOString();
    const end = new Date(Date.parse(start) + 864e5).toISOString();
    const [run, agents] = await Promise.all([
      supabaseAdmin.from("lead_distribution_runs").select("work_date,status,trigger,per_agent,moved,duplicates_skipped,actor_label,created_at,updated_at").eq("work_date", data.date).maybeSingle(),
      lp.activeAgents(),
    ]);
    if (run.error) throw new Error("Run record unavailable");
    const assignments: { to_agent_id: string | null; created_at: string; lead_id: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const page = await supabaseAdmin.from("lead_assignments").select("to_agent_id,created_at,lead_id,id")
        .eq("source", "lead_database").gte("created_at", start).lt("created_at", end).order("id").range(from, from + 999);
      if (page.error) throw new Error("Assignment records unavailable");
      assignments.push(...(page.data ?? []));
      if ((page.data ?? []).length < 1000) break;
      if (from > 20000) throw new Error("Too many assignment records to show");
    }
    const unknown = [...new Set(assignments.map((a) => a.to_agent_id).filter((id): id is string => !!id && !agents.some((g) => g.id === id)))];
    const names: Record<string, string> = {};
    if (unknown.length) {
      const p = await supabaseAdmin.from("profiles").select("id,name").in("id", unknown);
      if (p.error) throw new Error("Agent names unavailable");
      for (const r of p.data ?? []) names[r.id] = r.name ?? "Unknown agent";
    }
    const result = groupHandout(agents.map((a) => ({ id: a.id, name: a.name })), assignments, names);
    return { date: data.date, run: run.data ?? null, ...result, measuredAt: new Date().toISOString() };
  });

/** LeadHub, read-only: hand-out counts per Dhaka day and agent over a range (max 62 days). */
export const readHandoutHistory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.extend({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
    .refine((v) => v.from <= v.to, "Start date must be on or before end date")
    .refine((v) => Date.parse(v.to) - Date.parse(v.from) < 62 * 864e5, "Choose at most 62 days").parse(input))
  .handler(async ({ data }) => {
    await deckReader(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { handoutHistory } = await import("@/lib/handout-results");
    const { pageAllParallel } = await import("@/lib/page-all");
    const { dhakaDay } = await import("@/lib/lead-groups");
    const start = new Date(`${data.from}T00:00:00+06:00`).toISOString();
    const end = new Date(Date.parse(`${data.to}T00:00:00+06:00`) + 864e5).toISOString();
    const rows = await pageAllParallel((a, b) => supabaseAdmin.from("lead_assignments").select("id,to_agent_id,created_at,lead_id")
      .eq("source", "lead_database").gte("created_at", start).lt("created_at", end).order("id").range(a, b));
    if (rows.error) throw new Error("Assignment records unavailable");
    const ids = [...new Set((rows.data ?? []).map((r) => r.to_agent_id).filter((x): x is string => !!x))];
    const names: Record<string, string> = {};
    if (ids.length) {
      const p = await supabaseAdmin.from("profiles").select("id,name").in("id", ids);
      if (p.error) throw new Error("Agent names unavailable");
      for (const r of p.data ?? []) names[r.id] = r.name ?? "Unknown agent";
    }
    const days = handoutHistory(rows.data ?? [], dhakaDay);
    const agents = ids.map((id) => ({ id, name: names[id] ?? "Unknown agent" })).sort((a, b) => a.name.localeCompare(b.name));
    return { days, agents, measuredAt: new Date().toISOString() };
  });

/** LeadHub, read-only: how often the dry run was opened, by chosen date, weekday and blocked state. */
export const readDryRunUsage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.extend({ days: z.number().int().min(1).max(90).default(30) }).parse(input))
  .handler(async ({ data }) => {
    await deckReader(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pageAllParallel } = await import("@/lib/page-all");
    const since = new Date(Date.now() - data.days * 864e5).toISOString();
    const r = await pageAllParallel((a, b) => supabaseAdmin.from("distribution_preview_views").select("id,target_day,mode,weekday,blocked").gte("viewed_at", since).order("id").range(a, b));
    if (r.error) throw new Error("Dry-run usage unavailable");
    const { tallyDryRunUsage } = await import("@/lib/dry-run-usage");
    return { ...tallyDryRunUsage(r.data ?? []), days: data.days };
  });
