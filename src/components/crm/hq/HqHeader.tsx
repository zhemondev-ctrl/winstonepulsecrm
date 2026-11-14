import { BarChart3, ShieldCheck } from "lucide-react";
import { useT } from "@/lib/i18n";

/** Page title strip for the Control Board (HQ) page. */
export function HqHeader() {
  const t = useT();
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-card text-gold">
          <BarChart3 className="size-6" />
        </span>
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold sm:text-3xl">
            {t({ bn: "এক্সিকিউটিভ এইচকিউ", en: "Executive HQ" })}
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {t({ bn: "টিমের কাজ · লিডের অগ্রগতি · ব্যবসার ফলাফল", en: "Team performance · Lead progress · Business results" })}
          </p>
        </div>
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-gold" />
        {t({ bn: "তদারকি ও পর্যালোচনা", en: "Oversight & review" })}
      </p>
    </header>
  );
}
