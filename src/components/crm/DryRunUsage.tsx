import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dryRunUsageCsv } from "@/lib/dry-run-usage";
import { useState } from "react";

import { readDryRunUsage } from "@/lib/lead-pool.functions";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";

const STATUS: Record<string, { en: string; bn: string }> = {
  none: { en: "Normal day", bn: "সাধারণ দিন" },
  paused: { en: "Paused", bn: "বিরতি" },
  not_distribution_day: { en: "Friday / holiday", bn: "শুক্রবার / ছুটি" },
};

function Bars({ title, items, label }: { title: string; items: { label: string; n: number }[]; label?: (s: string) => string }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : (
        <ul className="space-y-1">{items.map((i) => (
          <li key={i.label} className="flex items-center gap-2 text-sm">
            <span className="w-28 shrink-0 truncate">{label ? label(i.label) : i.label}</span>
            <span className="h-3 rounded bg-primary" style={{ width: `${(i.n / max) * 60}%` }} />
            <span className="tabular-nums">{i.n}</span>
          </li>))}</ul>)}
    </div>
  );
}

/** LeadHub: how often the dry run was opened, by chosen date, weekday and paused/Friday status. */
export function DryRunUsage() {
  const t = useT();
  const adminToken = useAdminToken();
  const [days, setDays] = useState(30);
  const read = useServerFn(readDryRunUsage);
  const q = useQuery({ queryKey: ["dry-run-usage", adminToken, days], queryFn: () => read({ data: { adminToken, days } }) });
  const d = q.data;
  return (
    <section className="card-elevated space-y-4 p-4 md:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <BarChart3 className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{t({ en: "Dry-run usage", bn: "ড্রাই-রান ব্যবহার" })}</h2>
            <p className="text-sm text-muted-foreground">{t({ en: "How often the dry run was opened, counted from when this was added.", bn: "ড্রাই-রান কতবার খোলা হয়েছে — এটি যোগ হওয়ার পর থেকে গণনা।" })}{d ? ` ${t({ en: `Total: ${d.total}`, bn: `মোট: ${d.total}` })}` : ""}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="h-10" disabled={!d} onClick={() => {
          if (!d) return;
          const blob = new Blob(["\uFEFF" + dryRunUsageCsv(d, (s) => STATUS[s]?.en ?? s)], { type: "text/csv;charset=utf-8" });
          const url = URL.createObjectURL(blob); const a = document.createElement("a");
          a.href = url; a.download = `dry-run-usage-last-${days}-days.csv`; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 30_000);
        }}><Download className="size-4" />CSV</Button>
        <select aria-label="Range" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[7, 30, 90].map((n) => <option key={n} value={n}>{t({ en: `Last ${n} days`, bn: `শেষ ${n} দিন` })}</option>)}
        </select>
        </div>
      </header>
      {q.isLoading ? <p className="text-sm text-muted-foreground">{t({ en: "Loading…", bn: "লোড হচ্ছে…" })}</p>
        : q.isError ? <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Unavailable"}</p>
        : d && (
          <div className="grid gap-6 md:grid-cols-3">
            <Bars title={t({ en: "By chosen date", bn: "বেছে নেওয়া তারিখ" })} items={d.byDate.slice(0, 14)} />
            <Bars title={t({ en: "By weekday", bn: "সপ্তাহের দিন" })} items={d.byWeekday} />
            <Bars title={t({ en: "Paused / Friday status", bn: "বিরতি / শুক্রবার" })} items={d.byStatus} label={(s) => t(STATUS[s] ?? { en: s, bn: s })} />
          </div>)}
    </section>
  );
}
