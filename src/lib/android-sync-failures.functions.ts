import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { SyncFailureRow } from "@/lib/android-sync-failures";

export const SYNC_FAILURES_CAP = 3000;

const Input = z
  .object({
    adminToken: z.string().nullable().optional(),
    fromIso: z.string().datetime(),
    toIso: z.string().datetime(),
  })
  .refine((v) => Date.parse(v.toIso) > Date.parse(v.fromIso), { message: "End must be after start" })
  .refine((v) => Date.parse(v.toIso) - Date.parse(v.fromIso) <= 31 * 86_400_000, { message: "Range is limited to 31 days" });

/**
 * HQ/IT (authority) read-only summary of Android sync failures reported by
 * agent phones. No writes; only the safe DTO fields leave the server.
 */
export const listAndroidSyncFailures = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireAuthority(caller);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { SYNC_FAILURE_EVENT, toSyncFailureEvent } = await import("@/lib/android-sync-failures");

    const res = await supabaseAdmin
      .from("sync_events")
      .select("id, agent_id, device_id, created_at, payload")
      .eq("status", "failed")
      .eq("event_type", SYNC_FAILURE_EVENT)
      .gte("created_at", data.fromIso)
      .lt("created_at", data.toIso)
      .order("created_at", { ascending: false })
      .limit(SYNC_FAILURES_CAP);
    if (res.error) throw new Error("Could not read sync failures");
    const rows = (res.data ?? []) as SyncFailureRow[];

    const agentIds = [...new Set(rows.map((r) => r.agent_id).filter((v): v is string => Boolean(v)))];
    const deviceIds = [...new Set(rows.map((r) => r.device_id).filter((v): v is string => Boolean(v)))];
    const [profiles, devices] = await Promise.all([
      agentIds.length
        ? supabaseAdmin.from("profiles").select("id, name").in("id", agentIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null }[], error: null }),
      deviceIds.length
        ? supabaseAdmin.from("agent_devices").select("id, app_version").in("id", deviceIds)
        : Promise.resolve({ data: [] as { id: string; app_version: string | null }[], error: null }),
    ]);
    if (profiles.error || devices.error) throw new Error("Could not read agent names");
    const names = new Map((profiles.data ?? []).map((p) => [p.id, p.name ?? ""]));
    const versions = new Map((devices.data ?? []).map((d) => [d.id, d.app_version ?? ""]));

    return {
      events: rows.map((r) => toSyncFailureEvent(r, names, versions)),
      capped: rows.length >= SYNC_FAILURES_CAP,
      readAtUtc: new Date().toISOString(),
    };
  });

/**
 * HQ/IT (authority) read-only call sync audit log: saved call events plus
 * call-related failures with reason and retry state. Phone numbers are never selected.
 */
export const listCallSyncAudit = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireAuthority(caller);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { SYNC_FAILURE_EVENT, toSyncFailureEvent } = await import("@/lib/android-sync-failures");
    const { CALL_SUCCESS_EVENTS, buildCallSyncAudit, failureEntry, successEntry } = await import("@/lib/call-sync-audit");

    const [ok, bad] = await Promise.all([
      supabaseAdmin
        .from("sync_events")
        .select("id, agent_id, event_type, created_at, processed_at, lead_a:payload->>lead_id, lead_b:payload->>leadId")
        .eq("status", "processed")
        .in("event_type", [...CALL_SUCCESS_EVENTS])
        .gte("created_at", data.fromIso)
        .lt("created_at", data.toIso)
        .order("created_at", { ascending: false })
        .limit(SYNC_FAILURES_CAP),
      supabaseAdmin
        .from("sync_events")
        .select("id, agent_id, device_id, created_at, payload")
        .eq("status", "failed")
        .eq("event_type", SYNC_FAILURE_EVENT)
        .gte("created_at", data.fromIso)
        .lt("created_at", data.toIso)
        .order("created_at", { ascending: false })
        .limit(SYNC_FAILURES_CAP),
    ]);
    if (ok.error || bad.error) throw new Error("Could not read call sync audit log");
    const okRows = (ok.data ?? []) as unknown as Array<{ id: string; agent_id: string | null; event_type: string; created_at: string; processed_at: string | null; lead_a: string | null; lead_b: string | null }>;
    const badRows = (bad.data ?? []) as SyncFailureRow[];

    const agentIds = [...new Set([...okRows, ...badRows].map((r) => r.agent_id).filter((v): v is string => Boolean(v)))];
    const profiles = agentIds.length
      ? await supabaseAdmin.from("profiles").select("id, name").in("id", agentIds)
      : { data: [] as { id: string; name: string | null }[], error: null };
    if (profiles.error) throw new Error("Could not read agent names");
    const names = new Map((profiles.data ?? []).map((p) => [p.id, p.name ?? ""]));

    const successes = okRows
      .map((r) => successEntry({ ...r, lead_id: r.lead_a ?? r.lead_b }, names))
      .filter((e): e is NonNullable<typeof e> => e !== null);
    const failures = badRows
      .map((r) => failureEntry(toSyncFailureEvent(r, names, new Map())))
      .filter((e): e is NonNullable<typeof e> => e !== null);

    return {
      ...buildCallSyncAudit(successes, failures),
      capped: okRows.length >= SYNC_FAILURES_CAP || badRows.length >= SYNC_FAILURES_CAP,
      readAtUtc: new Date().toISOString(),
    };
  });
