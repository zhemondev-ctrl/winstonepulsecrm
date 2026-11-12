import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History } from "lucide-react";
import { useState } from "react";

import { readHandoutHistory } from "@/lib/lead-pool.functions";
import { dhakaDay } from "@/lib/lead-groups";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";

/** LeadHub: read-only history of leads handed out per day and agent. */
export function HandoutHistory() {
  const t = useT();
  const adminToken = useAdminToken();
  const today = dhakaDay(new Date().toISOString());
  const [from, setFrom] = useState(dhakaDay(new Date(Date.now() - 13 * 864e5).toISOString()));
  const [to, setTo] = useState(today);
  const read = useServerFn(readHandoutHistory);
  const q = useQuery({ queryKey: ["handout-history", adminToken, from, to], queryFn: () => read({ data: { adminToken, from, to } }) });
  const d = q.data;
  const input = "h-10 rounded-md border border-input bg-background px-3 text-sm";
  return (
    <section className="card-elevated space-y-4 p-4 md:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <History className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{t({ en: "Hand-out history", bn: "বণ্টনের ইতিহাস" })}</h2>
            <p className="text-sm text-muted-foreground">{t({ en: "Leads each agent received from the lead database, by day. Read-only.", bn: "লিড ডাটাবেস থেকে প্রতিদিন প্রত্যেক এজেন্ট কত লিড পেয়েছে। শুধু দেখা যাবে।" })}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" aria-label="From" className={input} value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          <input type="date" aria-label="To" className={input} value={to} min={from} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </div>
      </header>
      {q.isLoading ? <p className="text-sm text-muted-foreground">{t({ en: "Loading…", bn: "লোড হচ্ছে…" })}</p>
        : q.isError ? <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : t({ en: "Unlock LeadHub with its PIN to see history.", bn: "ইতিহাস দেখতে পিন দিয়ে LeadHub খুলুন।" })}</p>
        : !d || d.days.length === 0 ? <p className="text-sm text-muted-foreground">{t({ en: "No leads handed out in this range.", bn: "এই সময়ে কোনো লিড বণ্টন হয়নি।" })}</p>
        : (<>
          <ul className="space-y-2 md:hidden">{d.days.map((day) => (
            <li key={day.day} className="rounded-lg border border-border p-3">
              <div className="flex justify-between font-medium"><span>{day.day}</span><span className="tabular-nums">{day.total}</span></div>
              <p className="mt-1 text-xs text-muted-foreground">{d.agents.filter((a) => day.counts[a.id]).map((a) => `${a.name} ${day.counts[a.id]}`).join(" · ")}</p>
            </li>))}</ul>
          <div className="table-scroll hidden md:block">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-3">{t({ en: "Date", bn: "তারিখ" })}</th>
                {d.agents.map((a) => <th key={a.id} className="py-2 pr-3 whitespace-nowrap">{a.name}</th>)}
                <th className="py-2 text-right">{t({ en: "Total", bn: "মোট" })}</th>
              </tr></thead>
              <tbody>{d.days.map((day) => (
                <tr key={day.day} className="border-b border-border/60">
                  <td className="py-2 pr-3 whitespace-nowrap">{day.day}</td>
                  {d.agents.map((a) => <td key={a.id} className="py-2 pr-3 tabular-nums">{day.counts[a.id] ?? 0}</td>)}
                  <td className="py-2 text-right font-semibold tabular-nums">{day.total}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </>)}
    </section>
  );
}
