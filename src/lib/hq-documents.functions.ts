import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Private HQ documents. Only Executive HQ / IT authority may get a short-lived link. */
export const MD_APPROVAL_REPORT = {
  path: "md-approval/Winstone_Pulse_MD_Approval_Report_v2.pdf",
  filename: "Winstone_Pulse_MD_Approval_Report_v2.pdf",
} as const;

export const getMdApprovalReportLink = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(value))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("./access.server");
    const caller = await resolveCaller(data.adminToken);
    if (caller.scope !== "authority") throw new Error("Executive HQ or IT access required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("hq-documents")
      .createSignedUrl(MD_APPROVAL_REPORT.path, 60, { download: MD_APPROVAL_REPORT.filename });
    if (error || !signed?.signedUrl) throw new Error("Report is not available right now. Please try again.");
    return { url: signed.signedUrl };
  });
