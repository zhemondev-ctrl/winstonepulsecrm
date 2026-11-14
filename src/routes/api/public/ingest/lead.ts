import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createRateLimiter, requestSourceKey } from "@/lib/rate-limit";

const leadIngestLimiter = createRateLimiter(120, 60_000);

/** Webhook payload from website forms / Facebook lead ads. */
const Payload = z.object({
  name: z.string().trim().min(1).max(120),
  phone_number: z.string().trim().min(6).max(24),
  company: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  source: z.string().trim().max(40).default("webhook"),
  /** Legacy field from older phone apps; ignored — captures never self-assign. */
  assign: z.boolean().optional(),
  /** Legacy hint; ignored. The capturing agent comes from the device token. */
  agent_id: z.string().uuid().nullable().optional(),
  /** App version that captured the lead, for the version data ledger. */
  app_version: z.string().trim().max(40).nullable().optional(),
  version_code: z.number().int().nullable().optional(),
  client_ref: z.string().trim().max(80).nullable().optional(),
  captured_offline: z.boolean().optional(),
  captured_at: z.string().datetime({ offset: true }).nullable().optional(),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/ingest/lead")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!leadIngestLimiter(requestSourceKey(request))) {
          return json({ error: "Rate limited", retryable: true }, 429);
        }
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);

        {
          const { requireAgentBriefing } = await import("@/lib/agent-briefing.server");
          const briefingBlock = await requireAgentBriefing(caller.profile.id);
          if (briefingBlock) return json(briefingBlock, 409);
        }

        const parsed = Payload.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid payload" }, 400);
        const body = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Phone-captured leads always land UNASSIGNED: LeadHub Nexus is the only
        // assignment authority (50/day cap, eligibility, briefing). Legacy
        // `assign` / `agent_id` fields are ignored. Capture is still attributed
        // to the signed-in agent through reference_by, the audit actor and the
        // version ledger.
        const { data: capturer } = await supabaseAdmin
          .from("profiles").select("id, name").eq("id", caller.profile.id).maybeSingle();
        const capturerName = capturer?.name ?? null;

        // Shared intake with the web desk: identical result either way.
        const { submitCollection } = await import("@/lib/lead-collection.server");
        try {
          // The device's stable client reference is scoped to its verified actor.
          // Older clients are still duplicate-safe through canonical phone identity.
          let requestKey = crypto.randomUUID();
          if (body.client_ref) {
            const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${caller.device.id}:${body.client_ref}`)));
            digest[6] = ((digest[6] ?? 0) & 15) | 64; digest[8] = ((digest[8] ?? 0) & 63) | 128;
            const h = Array.from(digest.slice(0,16), byte => byte.toString(16).padStart(2,"0")).join("");
            requestKey = `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
          }
          const result = await submitCollection(caller.profile.id, requestKey, [{ name: body.name, phoneNumber: body.phone_number,
            company: body.company ?? "", notes: body.notes ?? "", address: "", serialNo: "", referenceBy: capturerName ?? "" }]);
          const first = result.results[0];
          if (!first) return json({ error: "Lead could not be saved" }, 500);
          // Never expose a duplicate lead's ID or persist the device's guessed
          // customer fields into that existing lead's version history.
          if (first.status === "duplicate") return json({ ok: true, duplicate: true, lead_id: null }, 200);
          // Version data guarantee: remember which app version captured this
          // lead (and whether it was written offline), so the data can be
          // handed back if that version is replaced or reinstalled.
          if (first.receiptId) {
            const { recordVersionData } = await import("@/lib/version-ledger.server");
            await recordVersionData({
              entityType: "lead",
              // Key the restoration payload by its collector receipt, never a
              // mutable customer's ID. It cannot overwrite another lead ledger.
              entityId: first.receiptId,
              appVersion: body.app_version ?? caller.device.app_version ?? null,
              versionCode: body.version_code ?? null,
              deviceId: caller.device.id,
              agentId: caller.profile.id,
              clientRef: body.client_ref ?? null,
              capturedOffline: body.captured_offline ?? false,
              createdOfflineAt: body.captured_at ?? null,
              payload: {
                name: body.name,
                phone_number: body.phone_number,
                company: body.company ?? null,
                notes: body.notes ?? null,
                duplicate: false,
              },
            });
          }
          return json({ ok: true, lead_id: null, receipt_id: first.receiptId, assigned_to: null, routing: "leadhub_nexus" }, 201);
        } catch (err) {
          if (err instanceof z.ZodError)
            return json({ error: "Invalid customer name or phone number", code: "invalid_phone" }, 400);
          if (err instanceof Error && /Daily personal lead limit/.test(err.message)) return json({ error: "Daily personal lead limit reached", code: "self_lead_daily_cap" }, 409);
          return json({ error: "Lead could not be saved" }, 500);
        }
      },
    },
  },
});
