import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Official development notice. IT Console (full write PIN) and the System
 * Architect can start it; only a verified Architect session can confirm and reopen.
 */

async function architect(session: string) {
  const m = await import("@/lib/maintenance.server");
  const who = await m.architectFromRequest();
  if (!who || !m.architectSessionValid(session, who.userId)) {
    throw new Error("Architect session expired — sign in again");
  }
  return who;
}

async function itCaller(adminToken: string | null | undefined) {
  const { resolveCaller } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken ?? null, { skipMaintenance: true });
  if (caller.scope !== "authority" || caller.readOnly) throw new Error("IT Console access required");
  return { kind: "it_console" as const, profileId: caller.profile?.id ?? null, name: caller.profile?.name ?? "IT Console" };
}

/** Current state plus the on/off history; a history read failure never hides the state. */
async function stateWithHistory() {
  const { readDevelopmentHold, developmentHoldHistory } = await import("@/lib/development-hold.server");
  const hold = await readDevelopmentHold();
  try {
    return { ...hold, history: await developmentHoldHistory(), historyError: null };
  } catch (error) {
    console.error("development hold history failed", error instanceof Error ? error.message : error);
    return { ...hold, history: [], historyError: "unavailable" as const };
  }
}

export const itDevelopmentHold = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(input))
  .handler(async ({ data }) => {
    await itCaller(data.adminToken);
    return stateWithHistory();
  });

export const itStartDevelopmentHold = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(input))
  .handler(async ({ data }) => {
    const who = await itCaller(data.adminToken);
    const { startDevelopmentHold } = await import("@/lib/development-hold.server");
    return startDevelopmentHold({ who });
  });

export const architectDevelopmentHold = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ session: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    await architect(data.session);
    return stateWithHistory();
  });

export const architectStartDevelopmentHold = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ session: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    const who = await architect(data.session);
    const { startDevelopmentHold } = await import("@/lib/development-hold.server");
    return startDevelopmentHold({ who: { kind: "architect", userId: who.userId, email: who.email } });
  });

export const architectConfirmDevelopmentHold = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ session: z.string().min(10), note: z.string().trim().min(3).max(300) }).parse(input),
  )
  .handler(async ({ data }) => {
    const who = await architect(data.session);
    const { confirmDevelopmentHold } = await import("@/lib/development-hold.server");
    return confirmDevelopmentHold({ who: { kind: "architect", userId: who.userId, email: who.email }, note: data.note });
  });
