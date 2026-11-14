import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * HQ/IT (authority) read-only: real-phone acceptance per agent phone
 * (installed → signed in → verified test call). Returns no customer numbers,
 * leads or audio — only statuses and times. No writes.
 */
export const listPhoneAcceptance = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    requireAuthority(await resolveCaller(data.adminToken ?? null));
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [agents, devices] = await Promise.all([
      db.from("profiles").select("id, name").eq("role", "agent").eq("is_active", true)
        .eq("approval_status", "approved").order("name").limit(500),
      db.from("agent_devices")
        .select("id, profile_id, manufacturer, model, app_version, android_version, last_seen_at, created_at, revoked_at")
        .eq("platform", "android").is("revoked_at", null).order("last_seen_at", { ascending: false }).limit(2000),
    ]);
    if (agents.error || devices.error) throw new Error("Phone checklist unavailable; try again later");

    const ids = (devices.data ?? []).map((d) => d.id);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const calls: Array<{
      device_id: string | null; agent_id: string | null; created_at: string; call_status: string | null;
      duration_seconds: number | null; call_source: string | null; talk_time_source: string | null;
    }> = [];
    for (let i = 0; i < ids.length; i += 200) {
      const r = await db.from("call_recordings")
        .select("device_id, agent_id, created_at, call_status, duration_seconds, call_source, talk_time_source")
        .in("device_id", ids.slice(i, i + 200)).gte("created_at", since)
        .order("created_at", { ascending: false }).limit(1000);
      if (r.error) throw new Error("Phone checklist unavailable; try again later");
      calls.push(...(r.data ?? []));
    }

    const { evaluatePhoneAcceptance } = await import("@/lib/phone-acceptance");
    const { apkReleaseStatus } = await import("@/lib/apk-release");
    const { readCurrentApkRelease } = await import("@/lib/apk-release.server");
    const release = await readCurrentApkRelease();
    const now = Date.now();
    const names = new Map((agents.data ?? []).map((a) => [a.id, a.name as string]));
    const phones = (devices.data ?? [])
      .filter((d) => names.has(d.profile_id))
      .map((d) => ({
        id: d.id,
        agentName: names.get(d.profile_id) ?? "",
        label: [d.manufacturer, d.model].filter(Boolean).join(" ") || "Android phone",
        appVersion: d.app_version,
        androidVersion: d.android_version,
        lastSeenAt: d.last_seen_at,
        ...evaluatePhoneAcceptance({ device: d, agentId: d.profile_id, calls, expectedVersion: release.version, now }),
      }));
    const withPhone = new Set((devices.data ?? []).map((d) => d.profile_id));
    const noPhone = (agents.data ?? []).filter((a) => !withPhone.has(a.id)).map((a) => a.name as string);
    return { checkedAt: new Date(now).toISOString(), expectedVersion: release.version, official: apkReleaseStatus(release) === "official", phones, noPhone };
  });
