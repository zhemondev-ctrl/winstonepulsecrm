import { createServerFn } from "@tanstack/react-start";

/**
 * Homepage "best performer of the day" board.
 *
 * Public on purpose — the entry hall is shown before sign-in — so it returns
 * only floor-level aggregates and agent display names, never phone numbers,
 * lead data or anything customer-identifying.
 */
export const topPerformerToday = createServerFn({ method: "GET" }).handler(async () => {
  // Polled every minute by the public entry page: a backend read failing during
  // a restart or outage returns a typed "unavailable" (null), never a 500 and
  // never a board of invented zeros.
  try {
    const { dailyTopPerformer } = await import("@/lib/top-performer.server");
    return await dailyTopPerformer();
  } catch (error) {
    console.error("[topPerformerToday] results unavailable:", error instanceof Error ? error.message : error);
    return null;
  }
});

/** Public history is an explicit aggregate projection, never raw source records. */
export const topPerformerOnDate = createServerFn({ method: "GET" })
  .inputValidator((input: { date: string }) => {
    if (!input || typeof input.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Invalid performance date");
    return { date: input.date };
  })
  .handler(async ({ data }) => {
    const { dailyTopPerformer } = await import("@/lib/top-performer.server");
    const board = await dailyTopPerformer(new Date(), data.date);
    const project = (agent: (typeof board.otherAgents)[number]) => ({
      agentId: agent.agentId, name: agent.name, score: agent.score, rank: agent.rank,
      completed: agent.completed, reports: agent.reports, followUps: agent.followUps,
      called: agent.called, connected: agent.connected,
    });
    return { dateKey: board.dateKey, generatedAt: board.generatedAt, revealAt: board.revealAt, revealed: board.revealed, topThree: board.revealed ? board.topThree.map(project) : [], otherAgents: board.revealed ? board.otherAgents.map(project) : [] };
  });
