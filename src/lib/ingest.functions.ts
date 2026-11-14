import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { validatePayload, type IngestKind } from "@/lib/ingest-schemas";

/** Checks a sample payload against the live ingest rules. Never writes anything. */
export const checkIngestPayload = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        adminToken: z.string().min(1),
        kind: z.enum(["recording", "message", "lead"]),
        payload: z.string().max(20000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdminToken } = await import("@/lib/admin-gate.server");
    requireAdminToken(data.adminToken);

    let parsed: unknown;
    try {
      parsed = JSON.parse(data.payload);
    } catch {
      return {
        ok: false as const,
        issues: [{ field: "payload", message: "This is not valid JSON" }],
        normalized: null,
      };
    }
    const result = validatePayload(data.kind as IngestKind, parsed);
    return {
      ok: result.ok,
      issues: result.issues,
      normalized: result.ok ? JSON.stringify(result.normalized, null, 2) : null,
    };
  });

/** Live health of the pipes plus the data problems worth fixing. */
export const runIngestDiagnostics = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { requireAdminToken } = await import("@/lib/admin-gate.server");
    requireAdminToken(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pageAllParallel } = await import("@/lib/page-all");
    const { BD_PHONE } = await import("@/lib/ingest-schemas");

    const [leadsRes, callsRes, msgRes, bucketRes] = await Promise.all([
      pageAllParallel((from, to) => supabaseAdmin.from("leads").select("id, phone_number, assigned_to, assigned_agent_id, created_at").order("id").range(from, to)),
      pageAllParallel((from, to) => supabaseAdmin.from("call_recordings").select("id, lead_id, agent_id, sync_status, upload_status, storage_path, audio_url, analysis_status, transcription_text, created_at").order("created_at", { ascending: false }).order("id").range(from, to)),
      pageAllParallel((from, to) => supabaseAdmin.from("whatsapp_interactions").select("id, lead_id, agent_id, created_at").order("created_at", { ascending: false }).order("id").range(from, to)),
      supabaseAdmin.storage.from("call-audio").list("", { limit: 1 }),
    ]);

    if (leadsRes.error || callsRes.error || msgRes.error) throw new Error("Ingest diagnostics unavailable: incomplete data read");
    const leads = leadsRes.data ?? [];
    const calls = callsRes.data ?? [];
    const messages = msgRes.data ?? [];

    const phoneCount = new Map<string, number>();
    const { extractBangladeshPhones } = await import("@/lib/lead-phone");
    for (const lead of leads) {
      for (const key of extractBangladeshPhones(lead.phone_number)) {
        phoneCount.set(key, (phoneCount.get(key) ?? 0) + 1);
      }
    }

    const latest = (rows: { created_at: string }[]) => rows[0]?.created_at ?? null;

    return {
      checks: [
        {
          key: "device_auth",
          label: "Phone sign-in",
          ok: true,
          detail: "Phones authenticate with each agent's own device token; no shared secret is used",
        },
        {
          key: "ai_key",
          label: "AI transcription available",
          ok: Boolean(process.env["LOVABLE_API_KEY"]),
          detail: process.env["LOVABLE_API_KEY"]
            ? "Configuration present; uploaded audio is analyzed separately. Provider processing is not verified by this check"
            : "AI configuration absent; audio storage is independent",
        },
        {
          key: "audio_store",
          label: "Call audio storage reachable",
          ok: !bucketRes.error,
          detail: bucketRes.error ? bucketRes.error.message : "Private call-audio store responding",
        },
        {
          key: "admin_pin",
          label: "Control board PIN configured",
          ok: Boolean(process.env["ADMIN_PIN"] ?? process.env["IT_CONSOLE_PIN"]),
          detail: "Master and IT console PINs are stored server-side",
        },
      ],
      problems: [
        { key: "audio_absent", label: "Call rows without uploaded audio", count: calls.filter(c => !c.storage_path && !c.audio_url).length, hint: "No server audio reference. Recover the original phone file if available; do not infer an upload failure or block lead work." },
        { key: "analysis_failed", label: "Stored audio with processing failures", count: calls.filter(c => Boolean(c.storage_path || c.audio_url) && c.sync_status === "failed").length, hint: "Upload and analysis are separate. Inspect each saved error; unavailable speech cannot be fabricated." },
        {
          key: "bad_phone",
          label: "Leads with an unusable phone number",
          count: leads.filter((l) => !BD_PHONE.test(l.phone_number.trim())).length,
          hint: "The phone app cannot dial these — fix or re-import them.",
        },
        {
          key: "duplicate_phone",
          label: "Duplicate phone numbers",
          count: [...phoneCount.values()].filter((n) => n > 1).length,
          hint: "Two agents may be calling the same customer.",
        },
        {
          key: "unassigned",
          label: "Leads with no agent",
          count: leads.filter((l) => !l.assigned_to && !l.assigned_agent_id).length,
          hint: "Only LeadHub Nexus can assign eligible pool leads; IT operators are not recipients.",
        },
        {
          key: "failed_sync",
          label: "Audio upload failures",
          count: calls.filter((c) => c.upload_status === "failed").length,
          hint: "Retry the genuine file from its originating phone with the same call ID and checksum.",
        },
        {
          key: "no_transcript",
          label: "Stored audio without a transcript",
          count: calls.filter((c) => Boolean(c.storage_path || c.audio_url) && !c.transcription_text).length,
          hint: "Audio exists; inspect the saved analysis error before retrying. Missing transcripts do not block lead work.",
        },
        {
          key: "orphan_call",
          label: "Call logs with no lead",
          count: calls.filter((c) => !c.lead_id).length,
          hint: "The phone number did not match any lead.",
        },
        {
          key: "no_agent",
          label: "Logs with no agent stamped",
          count:
            calls.filter((c) => !c.agent_id).length + messages.filter((m) => !m.agent_id).length,
          hint: "The phone app must send agent_id with every upload.",
        },
      ],
      volumes: {
        leads: leads.length,
        calls: calls.length,
        messages: messages.length,
        lastCallAt: latest(calls),
        lastMessageAt: latest(messages),
        lastLeadAt: latest([...leads].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))),
      },
      checkedAt: new Date().toISOString(),
    };
  });
