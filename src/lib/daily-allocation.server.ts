import { dhakaDateOf } from "@/lib/business-day";
import { summarizeDailyAllocation } from "@/lib/daily-allocation";
import { activeAgents } from "@/lib/lead-pool.server";
import { readAllocationReceipts } from "@/lib/allocation-ledger.server";
import { checkCompanyAssignment } from "@/lib/company-assignment-check";
import { AUTO_PAUSE_CONFIG_ID } from "@/lib/backlog-cap";

/** Caller must be verified before entering this read-only helper. */
export async function readDailyAllocation(agentId?: string) {
  const day = dhakaDateOf();
  const agents = (await activeAgents()).filter(agent => !agentId || agent.id === agentId);
  const receipts = await readAllocationReceipts(day, agents.map(agent => agent.id));
  // Team run evidence stays behind the existing HQ/LeadHub gates, never Desk self scope.
  let operations: ReturnType<typeof checkCompanyAssignment> | null = null;
  if (!agentId) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [run, pause] = await Promise.all([
      supabaseAdmin.from("lead_distribution_runs").select("work_date,status,trigger,moved,updated_at").eq("work_date", day).maybeSingle(),
      supabaseAdmin.from("app_config").select("data").eq("id", AUTO_PAUSE_CONFIG_ID).maybeSingle(),
    ]);
    if (run.error || pause.error) throw new Error("Company assignment check unavailable. Please refresh.");
    operations = checkCompanyAssignment(day, run.data, pause.data?.data);
  }
  return { ...summarizeDailyAllocation(day, agents, receipts), operations };
}