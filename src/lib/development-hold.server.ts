import { NO_HOLD, parseDevelopmentHold, type DevelopmentHold } from "@/lib/development-hold";

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

async function save(hold: DevelopmentHold) {
  const client = await db();
  const { error } = await client
    .from("system_settings")
    .upsert({ key: KEY, value: hold as never, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error("Could not save the development notice");
  cache = null;
}

async function log(entry: { actor: string; actorRole: string; action: string; previous: string; next: string; reason?: string | null }) {
  const { audit } = await import("@/lib/maintenance.server");
  await audit({ ...entry, reason: entry.reason ?? null });
}

/** IT Console or System Architect: close the CRM for ordinary staff. Idempotent. */
export async function startDevelopmentHold(input: { actor: string; actorRole: "it_console" | "architect" }) {
  cache = null;
  const current = await readDevelopmentHold();
  if (current.active) return current;
  const hold: DevelopmentHold = {
    ...NO_HOLD,
    active: true,
    startedAt: new Date().toISOString(),
    startedBy: input.actor,
  };
  await save(hold);
  await log({ actor: input.actor, actorRole: input.actorRole, action: "development_hold_started", previous: "open", next: "development_hold" });
  return hold;
}

/** System Architect only (checked by the caller): confirm and reopen the CRM. */
export async function confirmDevelopmentHold(input: { actor: string; note: string }) {
  cache = null;
  const current = await readDevelopmentHold();
  if (!current.active) throw new Error("No development notice is active");
  const hold: DevelopmentHold = {
    ...current,
    active: false,
    releasedAt: new Date().toISOString(),
    releasedBy: input.actor,
    releaseNote: input.note,
  };
  await save(hold);
  await log({ actor: input.actor, actorRole: "architect", action: "development_hold_confirmed", previous: "development_hold", next: "open", reason: input.note });
  return hold;
}
