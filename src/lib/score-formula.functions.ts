import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { scoreFormulaSchema } from "./score-formula";

const CONFIG_ID = "daily_score_formula";
const token = z.object({ adminToken: z.string().nullable().optional() });

async function gate(adminToken: string | null | undefined, write: boolean) {
  const { resolveCaller, requireBookingReviewer, requireAuthority } = await import("./access.server");
  const caller = await resolveCaller(adminToken);
  if (write) await requireBookingReviewer(caller, adminToken); else requireAuthority(caller);
  return caller;
}

export const readScoreFormula = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => token.parse(v))
  .handler(async ({ data }) => {
    await gate(data.adminToken, false);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = await supabaseAdmin.from("app_config").select("data").eq("id", CONFIG_ID).maybeSingle();
    if (r.error) throw new Error("Score settings unavailable");
    const d = (r.data?.data ?? null) as { current?: unknown; savedAt?: string; savedBy?: string; history?: unknown[] } | null;
    const parsed = scoreFormulaSchema.safeParse(d?.current);
    return { formula: parsed.success ? parsed.data : null, savedAt: d?.savedAt ?? null, savedBy: d?.savedBy ?? null, versions: d?.history?.length ?? 0 };
  });

export const saveScoreFormula = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => token.extend({ formula: scoreFormulaSchema }).parse(v))
  .handler(async ({ data }) => {
    const caller = await gate(data.adminToken, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const prev = await supabaseAdmin.from("app_config").select("data").eq("id", CONFIG_ID).maybeSingle();
    if (prev.error) throw new Error("Score settings unavailable");
    const old = (prev.data?.data ?? {}) as { current?: unknown; savedAt?: string; savedBy?: string; history?: unknown[] };
    const savedAt = new Date().toISOString();
    const savedBy = caller.profile?.name ?? (caller.readOnly ? "Executive HQ" : "IT Console");
    // Keep every earlier version — settings history is never overwritten.
    const history = [...(old.history ?? []), ...(old.current ? [{ formula: old.current, savedAt: old.savedAt, savedBy: old.savedBy }] : [])];
    const w = await supabaseAdmin.from("app_config").upsert({ id: CONFIG_ID, data: JSON.parse(JSON.stringify({ current: data.formula, savedAt, savedBy, history })) });
    if (w.error) throw new Error("Could not save score settings");
    return { ok: true, savedAt };
  });
