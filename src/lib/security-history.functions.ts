import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const readSecurityHistory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().max(256).nullable() }).strict().parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("./access.server");
    const caller = await resolveCaller(data.adminToken);
    requireAuthority(caller);
    return (await import("./security-history.server")).securityHistory;
  });