import { dhakaDateOf } from "@/lib/business-day";
import { summarizeDailyAllocation } from "@/lib/daily-allocation";
import { activeAgents } from "@/lib/lead-pool.server";
import { readAllocationReceipts } from "@/lib/allocation-ledger.server";
import { checkCompanyAssignment } from "@/lib/company-assignment-check";
import { AUTO_PAUSE_CONFIG_ID } from "@/lib/backlog-cap";
import { nextHandoutAt, registrationBalances } from "@/lib/allocation-dashboard";
import { pageAllParallel } from "@/lib/page-all";

/** Caller must be verified before entering this read-only helper. */
export async function readDailyAllocation(agentId?: string) {
  const day = dhakaDateOf();
  const agents = (await activeAgents()).filter(agent => !agentId || agent.id === agentId);
  const receipts = await readAllocationReceipts(day, agents.map(agent => agent.id));
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [registrations, pause] = await Promise.all([
    agents.length ? pageAllParallel((from, to) => supabaseAdmin.from("agent_lead_receipts").select("id,agent_id,work_day").eq("work_day", day).in("agent_id", agents.map(agent => agent.id)).order("id").range(from, to)) : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from("app_config").select("data").eq("id", AUTO_PAUSE_CONFIG_ID).maybeSingle(),
  ]);
  if (registrations.error || pause.error) throw new Error("Registration balances unavailable. Please refresh.");
  const balances = registrationBalances(agents, day, registrations.data ?? []);
  // Team run evidence stays behind the existing HQ/LeadHub gates, never Desk self scope.
  let operations: ReturnType<typeof checkCompanyAssignment> | null = null;
  if (!agentId) {
    const run = await supabaseAdmin.from("lead_distribution_runs").select("work_date,status,trigger,moved,updated_at").eq("work_date", day).maybeSingle();
    if (run.error) throw new Error("Company assignment check unavailable. Please refresh.");
    operations = checkCompanyAssignment(day, run.data, pause.data?.data);
  }
  const summary = summarizeDailyAllocation(day, agents, receipts);
  return { ...summary, agents: summary.agents.map(agent => ({ ...agent, ...balances.get(agent.id) })), operations, nextHandoutAt: nextHandoutAt(Date.now(), pause.data?.data) };
}