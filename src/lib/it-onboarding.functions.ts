import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Token = z.object({ adminToken: z.string().nullable().optional() });

export const listItOfficerInvites = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Token.parse(input ?? {}))
  .handler(async ({ data }) => (await import("@/lib/it-onboarding.server")).listOfficerInvites(data.adminToken));

export const inviteItOfficer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Token.extend({ name: z.string().trim().min(2).max(80), email: z.string().trim().min(5).max(160), origin: z.string().url().max(200) }).parse(input),
  )
  .handler(async ({ data }) => (await import("@/lib/it-onboarding.server")).inviteOfficer(data));

export const approveItOfficer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Token.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => (await import("@/lib/it-onboarding.server")).approveOfficer(data));

export const myItOfficerSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await import("@/lib/it-onboarding.server")).ownOfficerSetup(context.userId));

export const markMyItPasswordSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await import("@/lib/it-onboarding.server")).markOwnPasswordSet(context.userId));
