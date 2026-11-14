import { dhakaDateOf, isDistributionDay } from "./business-day";
import { isAutoDistributionPaused } from "./backlog-cap";
import { PERSONAL_LEAD_DAILY_LIMIT, personalLeadAllowance } from "./lead-collection";

export function nextHandoutAt(now: number, pause: unknown) {
  const today = dhakaDateOf(now);
  for (let offset = 0; offset < 366; offset++) {
    const day = new Date(Date.parse(`${today}T00:00:00Z`) + offset * 864e5).toISOString().slice(0, 10);
    const instant = Date.parse(`${day}T09:10:00+06:00`);
    if (instant > now && isDistributionDay(day) && !isAutoDistributionPaused(day, pause)) return new Date(instant).toISOString();
  }
  return null;
}

export function registrationBalances(agents: { id: string }[], day: string, receipts: { id: string; agent_id: string; work_day: string }[]) {
  const sets = new Map(agents.map(agent => [agent.id, new Set<string>()]));
  for (const receipt of receipts) if (receipt.work_day === day) sets.get(receipt.agent_id)?.add(receipt.id);
  return new Map(agents.map(agent => {
    const registered = sets.get(agent.id)?.size ?? 0;
    return [agent.id, { registered, selfRemaining: personalLeadAllowance(registered), selfLimit: PERSONAL_LEAD_DAILY_LIMIT }];
  }));
}