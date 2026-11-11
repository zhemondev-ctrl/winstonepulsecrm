import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { getMdApprovalReportLink } from "@/lib/hq-documents.functions";

export function MdApprovalReportButton() {
  const t = useT();
  const token = useAdminToken();
  const getLink = useServerFn(getMdApprovalReportLink);
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    try {
      const { url } = await getLink({ data: { adminToken: token } });
      window.location.assign(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t({ en: "Download failed", bn: "ডাউনলোড ব্যর্থ" }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold">{t({ en: "MD approval report", bn: "এমডি অনুমোদন রিপোর্ট" })}</p>
        <p className="text-sm text-muted-foreground">{t({ en: "Meeting decisions and recommended plan · 11 Nov 2026 · PDF", bn: "মিটিং সিদ্ধান্ত ও প্রস্তাবিত পরিকল্পনা · ১১ নভেম্বর ২০২৬ · PDF" })}</p>
      </div>
      <Button onClick={onClick} disabled={busy} className="w-full sm:w-auto">
        <FileDown className="mr-2 h-4 w-4" />
        {busy ? t({ en: "Preparing…", bn: "প্রস্তুত হচ্ছে…" }) : t({ en: "Download PDF", bn: "PDF ডাউনলোড" })}
      </Button>
    </div>
  );
}
