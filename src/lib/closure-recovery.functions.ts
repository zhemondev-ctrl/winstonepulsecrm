import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const input = z.object({ adminToken: z.string().nullable().optional(), from: day, to: day })
  .refine(v => v.from <= v.to, "From must not follow To")
  .refine(v => Date.parse(v.to) - Date.parse(v.from) < 92 * 864e5, "Choose at most 92 days");

/**
 * Executive HQ / IT, read-only: leads closed in the Dhaka range without enough
 * verified call attempts. Nothing is reopened, reassigned or saved.
 */
export const readClosureRecoveryQueue = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => input.parse(value))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("./access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope !== "authority") throw new Error("Executive HQ or IT access required");
    const { readClosureQueue } = await import("./closure-recovery.server");
    return readClosureQueue(data.from, data.to);
  });
