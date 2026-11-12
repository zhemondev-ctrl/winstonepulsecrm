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
  return caller.profile?.name ?? "IT Console";
}

export const itDevelopmentHold = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(input))
  .handler(async ({ data }) => {
    await itCaller(data.adminToken);
    const { readDevelopmentHold } = await import("@/lib/development-hold.server");
    return readDevelopmentHold();
  });

export const itStartDevelopmentHold = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(input))
  .handler(async ({ data }) => {
    const actor = await itCaller(data.adminToken);
    const { startDevelopmentHold } = await import("@/lib/development-hold.server");
    return startDevelopmentHold({ actor, actorRole: "it_console" });
  });

export const architectDevelopmentHold = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ session: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    await architect(data.session);
    const { readDevelopmentHold } = await import("@/lib/development-hold.server");
    return readDevelopmentHold();
  });

export const architectStartDevelopmentHold = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ session: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    const who = await architect(data.session);
    const { startDevelopmentHold } = await import("@/lib/development-hold.server");
    return startDevelopmentHold({ actor: `System Architect (${who.email})`, actorRole: "architect" });
  });

export const architectConfirmDevelopmentHold = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ session: z.string().min(10), note: z.string().trim().min(3).max(300) }).parse(input),
  )
  .handler(async ({ data }) => {
    const who = await architect(data.session);
    const { confirmDevelopmentHold } = await import("@/lib/development-hold.server");
    return confirmDevelopmentHold({ actor: `System Architect (${who.email})`, note: data.note });
  });
