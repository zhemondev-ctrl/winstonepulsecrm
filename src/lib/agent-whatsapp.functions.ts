import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function agentCaller() {
  const { resolveWorkCaller } = await import("@/lib/access.server");
  const caller = await resolveWorkCaller(null);
  if (caller.scope !== "agent" || !caller.profile) throw new Error("Agent access required");
  return caller.profile;
}

/** Resolve only the agent's saved profile phone, never a client or SIM destination. */
async function ownNumber(agentId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { normalizeAgentWhatsApp } = await import("@/lib/agent-whatsapp");
  const { data, error } = await supabaseAdmin.from("profiles").select("phone").eq("id", agentId).maybeSingle();
  if (error) throw new Error("Profile phone unavailable");
  return normalizeAgentWhatsApp(data?.phone);
}

/** Signed-in agent's own WhatsApp alert opt-in and their last few alert statuses. */
export const getMyWhatsAppAlerts = createServerFn({ method: "POST" }).handler(async () => {
  const me = await agentCaller();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { normalizeAgentWhatsApp, agentAlertRecipient } = await import("@/lib/agent-whatsapp");
  const { alertsEnabled } = await import("@/lib/agent-whatsapp.server");
  const [optin, recent, profile, enabled] = await Promise.all([
    supabaseAdmin.from("agent_whatsapp_optins").select("whatsapp_number, opted_in, opted_out_at, opt_out_source").eq("agent_id", me.id).maybeSingle(),
    supabaseAdmin.from("agent_whatsapp_alerts").select("id, kind, status, created_at, error_detail")
      .eq("agent_id", me.id).order("created_at", { ascending: false }).limit(5),
    supabaseAdmin.from("profiles").select("phone").eq("id", me.id).maybeSingle(),
    alertsEnabled(),
  ]);
  if (optin.error || recent.error || profile.error) throw new Error("WhatsApp alert settings unavailable");
  return {
    enabled,
    optedIn: Boolean(agentAlertRecipient(profile.data?.phone, optin.data?.opted_in ?? false, optin.data?.whatsapp_number)),
    number: normalizeAgentWhatsApp(profile.data?.phone),
    optedOutByReply: optin.data?.opt_out_source === "whatsapp_reply" && !optin.data?.opted_in,
    recent: (recent.data ?? []).map((r) => ({ id: r.id, kind: r.kind, status: r.status, at: r.created_at, failed: r.status === "failed" })),
  };
});

export const setMyWhatsAppAlerts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ number: z.string().max(20).optional(), optedIn: z.boolean() }).strict().parse(input))
  .handler(async ({ data }) => {
    const me = await agentCaller();
    const { normalizeAgentWhatsApp } = await import("@/lib/agent-whatsapp");
    const number = await ownNumber(me.id);
    if (data.optedIn && (!number || (data.number !== undefined && normalizeAgentWhatsApp(data.number) !== number))) {
      throw new Error("শুধু আপনার প্রোফাইলের নিজের নম্বর ব্যবহার করুন / Use the number saved on your own profile");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    if (!data.optedIn) {
      const { error } = await supabaseAdmin.from("agent_whatsapp_optins").update({ opted_in: false, opted_out_at: now, opt_out_source: "crm", updated_at: now }).eq("agent_id", me.id);
      if (error) throw new Error("Could not save your WhatsApp alert choice");
      return { ok: true, number, optedIn: false };
    }
    if (!number) throw new Error("Save a valid phone on your profile first");
    const { error } = await supabaseAdmin.from("agent_whatsapp_optins").upsert({
      agent_id: me.id, whatsapp_number: number, opted_in: data.optedIn, updated_at: now,
      ...(data.optedIn ? { opted_in_at: now, opt_out_source: null } : { opted_out_at: now, opt_out_source: "crm" }),
    }, { onConflict: "agent_id" });
    if (error) throw new Error("Could not save your WhatsApp alert choice");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({ action: data.optedIn ? "agent_whatsapp_opt_in" : "agent_whatsapp_opt_out", entityType: "profiles", entityId: me.id, actorLabel: me.name, metadata: {} });
    return { ok: true, number, optedIn: data.optedIn };
  });

/** Sends the signed-in agent one test message (their own counts), at most once per Dhaka day. */
export const sendMyWhatsAppTest = createServerFn({ method: "POST" }).handler(async () => {
  const me = await agentCaller();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("agent_whatsapp_optins").select("whatsapp_number, opted_in").eq("agent_id", me.id).maybeSingle();
  if (error) throw new Error("WhatsApp alert settings unavailable");
  if (!data?.opted_in) throw new Error("আগে WhatsApp alert চালু করুন / Turn on WhatsApp alerts first");
  if ((await ownNumber(me.id)) !== data.whatsapp_number) {
    throw new Error("শুধু আপনার প্রোফাইলের নিজের নম্বরে পাঠানো যায় / Alerts go only to your own profile number");
  }
  const { sendSelfTest } = await import("@/lib/agent-whatsapp.server");
  const outcome = await sendSelfTest(me.id, me.name, data.whatsapp_number);
  return { outcome };
});

/** Agent sends today's own count-only report summary to the HQ WhatsApp number. */
export const sendMyReportSummaryToHq = createServerFn({ method: "POST" }).handler(async () => {
  const me = await agentCaller();
  const { sendReportSummaryToHq } = await import("@/lib/agent-whatsapp.server");
  return sendReportSummaryToHq(me.id, me.name);
});

const tokenInput = z.object({ adminToken: z.string().max(256).nullable() }).strict();

async function requireFullIt(token: string | null) {
  const { adminTokenScope } = await import("@/lib/admin-gate.server");
  if (adminTokenScope(token) !== "full") throw new Error("Full IT PIN required");
}

/** IT overview: master switch, Meta template review state and aggregate alert counts (no numbers, no names). */
export const getAgentWhatsAppAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenInput.parse(input))
  .handler(async ({ data }) => {
    await requireFullIt(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { alertsEnabled, readTemplateStatuses, readHqNumber } = await import("@/lib/agent-whatsapp.server");
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const [enabled, hqNumber, templates, optins, alerts] = await Promise.all([
      alertsEnabled(),
      readHqNumber(),
      readTemplateStatuses().catch(() => null),
      supabaseAdmin.from("agent_whatsapp_optins").select("agent_id", { count: "exact", head: true }).eq("opted_in", true),
      supabaseAdmin.from("agent_whatsapp_alerts").select("status").gte("created_at", since).limit(5000),
    ]);
    if (optins.error || alerts.error) throw new Error("Alert overview unavailable");
    const { readHqReportSettings } = await import("@/lib/hq-daily-report.server");
    const hqDaily = await readHqReportSettings();
    const lastHq = await supabaseAdmin.from("hq_whatsapp_report_sends").select("work_date, status, with_pdf").order("created_at", { ascending: false }).limit(3);
    const byStatus: Record<string, number> = {};
    for (const row of alerts.data ?? []) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    return { enabled, hqNumber, hqDaily: { enabled: hqDaily.enabled, recipients: hqDaily.recipients, last: lastHq.data ?? [] }, templates, optedIn: optins.count ?? 0, last7Days: byStatus };
  });

export const setAgentWhatsAppEnabled = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenInput.extend({ enabled: z.boolean() }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireFullIt(data.adminToken);
    const { setAlertsEnabled } = await import("@/lib/agent-whatsapp.server");
    await setAlertsEnabled(data.enabled);
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({ action: data.enabled ? "agent_whatsapp_alerts_on" : "agent_whatsapp_alerts_off", entityType: "system_settings", actorLabel: "IT Console", metadata: {} });
    return { enabled: data.enabled };
  });

export const setAgentWhatsAppHqNumber = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenInput.extend({ number: z.string().max(20).nullable() }).strict().parse(input))
  .handler(async ({ data }) => {
    await requireFullIt(data.adminToken);
    const { setHqNumber } = await import("@/lib/agent-whatsapp.server");
    const number = await setHqNumber(data.number?.trim() || null);
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({ action: "agent_whatsapp_hq_number_set", entityType: "system_settings", actorLabel: "IT Console", metadata: { set: Boolean(number) } });
    return { hqNumber: number };
  });
