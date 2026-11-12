import { NO_HOLD, parseDevelopmentHold, type DevelopmentHold } from "@/lib/development-hold";
import {
  HOLD_AUDIT_ACTIONS,
  buildHoldAuditEntry,
  toHoldHistory,
  type HoldActor,
  type HoldAuditEntry,
  type HoldHistoryItem,
} from "@/lib/development-hold-audit";

const KEY = "development_hold";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

let cache: { at: number; hold: DevelopmentHold } | null = null;
export function clearDevelopmentHoldCache() {
  cache = null;
}

/** Current hold. Throws when it cannot be read so callers can fail closed. */
export async function readDevelopmentHold(): Promise<DevelopmentHold> {
  const now = Date.now();
  if (cache && now - cache.at < 15_000) return cache.hold;
  const client = await db();
  const { data, error } = await client.from("system_settings").select("value").eq("key", KEY).maybeSingle();
  if (error) throw new Error("Development hold unavailable");
  const hold = data ? parseDevelopmentHold(data.value) : NO_HOLD;
  cache = { at: now, hold };
  return hold;
}

/**
 * Write the new state and its append-only audit row in ONE transaction
 * (set_development_hold_atomic). If the audit row cannot be written, the CRM is
 * neither closed nor reopened — an unrecorded change is impossible.
 */
async function switchHold(expectActive: boolean, hold: DevelopmentHold, entry: HoldAuditEntry): Promise<{ changed: boolean; hold: DevelopmentHold }> {
  const client = await db();
  const { data, error } = await client.rpc("set_development_hold_atomic", {
    _expect_active: expectActive,
    _hold: hold as never,
    _actor: entry.actor,
    _actor_role: entry.actorRole,
    _action: entry.action,
    _previous: entry.previous,
    _next: entry.next,
    _reason: entry.reason as string,
    _metadata: entry.metadata as never,
  });
  cache = null;
  if (error) {
    console.error("development hold switch failed", error.message);
    throw new Error("Could not save the development notice — nothing was changed");
  }
  const result = (data ?? {}) as { changed?: unknown; hold?: unknown };
  return { changed: result.changed === true, hold: parseDevelopmentHold(result.hold) };
}

/** IT Console or System Architect: close the CRM for ordinary staff. Idempotent. */
export async function startDevelopmentHold(input: { who: HoldActor }) {
  cache = null;
  const current = await readDevelopmentHold();
  if (current.active) return current;
  const entry = buildHoldAuditEntry({ change: "enable", who: input.who });
  const hold: DevelopmentHold = {
    ...NO_HOLD,
    active: true,
    startedAt: new Date().toISOString(),
    startedBy: entry.actor,
  };
  const result = await switchHold(false, hold, entry);
  return result.hold;
}

/** System Architect only (verified by the caller): confirm and reopen the CRM. */
export async function confirmDevelopmentHold(input: { who: Extract<HoldActor, { kind: "architect" }>; note: string }) {
  cache = null;
  const current = await readDevelopmentHold();
  if (!current.active) throw new Error("No development notice is active");
  const entry = buildHoldAuditEntry({ change: "disable", who: input.who, note: input.note });
  const hold: DevelopmentHold = {
    ...current,
    active: false,
    releasedAt: new Date().toISOString(),
    releasedBy: entry.actor,
    releaseNote: input.note,
  };
  const result = await switchHold(true, hold, entry);
  if (!result.changed) throw new Error("No development notice is active");
  return result.hold;
}

/** On/off history for IT Console and the Architect page (newest first). */
export async function developmentHoldHistory(limit = 50): Promise<HoldHistoryItem[]> {
  const client = await db();
  const { data, error } = await client
    .from("maintenance_audit")
    .select("id, at, action, actor, actor_role, reason, metadata")
    .in("action", [...HOLD_AUDIT_ACTIONS])
    .order("at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (error) throw new Error("Development notice history unavailable");
  return toHoldHistory(data ?? []);
}
