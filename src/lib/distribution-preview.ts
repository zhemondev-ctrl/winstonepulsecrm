/**
 * Dry-run of the daily lead distribution — pure, no I/O, no writes.
 * Mirrors distributeDailyLeads: quota (HQ target / floor round, max 50) →
 * Net-50 backlog cap → minus leads already received that day → round-robin over
 * the usable pool. The database review guard gives a locked desk nothing, but
 * its slots still sit in the round, exactly as in the real run.
 */
import { cappedQuota, type BacklogCap } from "@/lib/backlog-cap";

export type PreviewAgentInput = {
  id: string;
  name: string;
  quota: number;
  held: number;
  backlog: number;
  locked: boolean;
};

export type PreviewFlag = "review_lock" | "net50_zero" | "net50_reduced" | "already_full" | "pool_short";

export type PreviewRow = {
  id: string;
  name: string;
  quota: number;
  backlog: number;
  allowed: number;
  held: number;
  gap: number;
  wouldReceive: number;
  flags: PreviewFlag[];
};

export type PreviewBlock = "not_distribution_day" | "paused" | null;

export function planDistributionPreview(input: {
  agents: PreviewAgentInput[];
  cap: BacklogCap;
  pool: number;
  distributionDay: boolean;
  paused: boolean;
}) {
  const block: PreviewBlock = !input.distributionDay ? "not_distribution_day" : input.paused ? "paused" : null;
  const base = input.agents.map((a) => {
    const allowed = cappedQuota(a.quota, a.backlog, input.cap);
    const gap = Math.max(0, allowed - a.held);
    return { a, allowed, gap };
  });

  // Same slot order as the real run: round r gives one lead to every desk whose gap > r.
  const received = new Map<string, number>();
  if (!block) {
    const maxGap = Math.max(0, ...base.map((b) => b.gap));
    let poolLeft = input.pool;
    for (let round = 0; round < maxGap && poolLeft > 0; round += 1) {
      for (const b of base) {
        if (poolLeft <= 0) break;
        if (round < b.gap) {
          poolLeft -= 1;
          if (!b.a.locked) received.set(b.a.id, (received.get(b.a.id) ?? 0) + 1);
        }
      }
    }
  }

  const rows: PreviewRow[] = base.map(({ a, allowed, gap }) => {
    const wouldReceive = received.get(a.id) ?? 0;
    const flags: PreviewFlag[] = [];
    if (a.locked) flags.push("review_lock");
    if (input.cap.enabled && allowed === 0 && a.quota > 0) flags.push("net50_zero");
    else if (input.cap.enabled && allowed < a.quota) flags.push("net50_reduced");
    if (gap === 0 && allowed > 0) flags.push("already_full");
    if (!block && !a.locked && wouldReceive < gap) flags.push("pool_short");
    return { id: a.id, name: a.name, quota: a.quota, backlog: a.backlog, allowed, held: a.held, gap, wouldReceive: block ? 0 : wouldReceive, flags };
  });

  const need = block ? 0 : base.reduce((n, b) => n + b.gap, 0);
  return {
    block,
    rows,
    totals: {
      desks: rows.length,
      need,
      pool: input.pool,
      wouldAssign: rows.reduce((n, r) => n + r.wouldReceive, 0),
      lockedDesks: rows.filter((r) => r.flags.includes("review_lock")).length,
      net50Zero: rows.filter((r) => r.flags.includes("net50_zero")).length,
      net50Reduced: rows.filter((r) => r.flags.includes("net50_reduced")).length,
      reducedBy: rows.reduce((n, r) => n + (r.quota - r.allowed), 0),
      shortfall: block ? 0 : Math.max(0, need - input.pool),
    },
  };
}
