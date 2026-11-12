import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ClipboardCheck, Download, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { readHandoutResults } from "@/lib/lead-pool.functions";
import { downloadCsv, toCsv } from "@/lib/crm-reports";
import { dhakaDateOf } from "@/lib/business-day";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";

const time = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso)) : "—");

/** LeadHub, read-only: who actually received leads from the morning run on a chosen day. */
export function HandoutResults() {
  const t = useT();
  const adminToken = useAdminToken();
  const read = useServerFn(readHandoutResults);
  const [date, setDate] = useState(() => dhakaDateOf());
  const q = useQuery({
    queryKey: ["handout-results", date, adminToken],
    queryFn: () => read({ data: { adminToken, date } }),
    enabled: Boolean(adminToken && date),
  });
  const d = q.data;
  const exportCsv = () => d && downloadCsv(`handout-results-${d.date}.csv`, toCsv(["agent", "leads_received", "first_at_dhaka", "last_at_dhaka"], d.rows.map((r) => [r.name, r.received, time(r.firstAt), time(r.lastAt)])));

  return (
    <section className="card-elevated space-y-4 p-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t({ en: "Hand-out results — what actually happened", bn: "বণ্টনের ফল — আসলে কী হয়েছে" })}</h2>
            <p className="text-xs text-muted-foreground">{t({ en: "Leads each agent really received from the lead database on this Dhaka day, from saved assignment records. Read-only.", bn: "এই দিনে লিড ডেটাবেজ থেকে প্রতিটি এজেন্ট আসলে কত লিড পেয়েছেন, সংরক্ষিত রেকর্ড থেকে। শুধু দেখা যাবে।" })}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="handout-date">{t({ en: "Date", bn: "তারিখ" })}</label>
          <input id="handout-date" type="date" value={date} max={dhakaDateOf()} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm" />
          <Button variant="outline" size="sm" onClick={() => void q.refetch()} disabled={q.isFetching}><RefreshCw className={`mr-2 size-4 ${q.isFetching ? "animate-spin" : ""}`} />{t({ en: "Refresh", bn: "রিফ্রেশ" })}</Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!d}><Download className="mr-2 size-4" />CSV</Button>
        </div>
      </header>
      {!adminToken ? (
        <p className="text-sm text-muted-foreground">{t({ en: "Unlock LeadHub with its PIN to see results.", bn: "ফল দেখতে LeadHub পিন দিয়ে খুলুন।" })}</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Unavailable"}</p>
      ) : !d ? (
        <p className="text-sm text-muted-foreground">{t({ en: "Loading…", bn: "লোড হচ্ছে…" })}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {d.run
              ? t({ en: `Run: ${d.run.status} (${d.run.trigger}) · ${d.run.moved} moved · ${d.run.duplicates_skipped} duplicates skipped`, bn: `বণ্টন: ${d.run.status} (${d.run.trigger}) · ${d.run.moved} দেওয়া · ${d.run.duplicates_skipped} ডুপ্লিকেট বাদ` })
              : t({ en: "No morning run was recorded for this day (paused, Friday, or not run yet).", bn: "এই দিনে কোনো সকালের বণ্টন রেকর্ড নেই (স্থগিত, শুক্রবার বা এখনও চলেনি)।" })}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border p-3"><div className="text-xl font-semibold">{d.total}</div><div className="text-xs text-muted-foreground">{t({ en: "Leads handed out", bn: "মোট লিড দেওয়া" })}</div></div>
            <div className="rounded-lg border p-3"><div className="text-xl font-semibold">{d.receivedCount}</div><div className="text-xs text-muted-foreground">{t({ en: "Agents who received leads", bn: "লিড পেয়েছেন এমন এজেন্ট" })}</div></div>
          </div>
          <div className="rounded-lg border p-3 text-sm">
            <h3 className="font-semibold">{t({ en: "Forecast vs actual", bn: "পূর্বাভাস বনাম আসল" })}</h3>
            {!d.forecast ? (
              <p role="alert" className="mt-2 flex items-start gap-2 rounded-md border border-warning bg-warning/10 p-2 text-sm font-medium text-warning"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{t({ en: "No forecast to compare: no dry-run snapshot was saved for this date before the day began (Dhaka). Next time, open the dry run for this date ahead of time.", bn: "তুলনার পূর্বাভাস নেই: এই দিন শুরুর আগে (ঢাকা) কোনো ড্রাই-রান স্ন্যাপশট সংরক্ষিত হয়নি। পরের বার আগেই এই তারিখের ড্রাই-রান খুলুন।" })}</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">{t({ en: `Forecast saved ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(d.forecast.takenAt))} (Dhaka): ${d.forecast.wouldAssign} leads expected, ${d.total} handed out.`, bn: `পূর্বাভাস সংরক্ষণ: ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(d.forecast.takenAt))} — প্রত্যাশিত ${d.forecast.wouldAssign}, দেওয়া ${d.total}।` })}</p>
                <ul className="mt-2 space-y-1">{d.forecast.rows.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{r.name}</span>
                    <span className="tabular-nums">{r.forecast} → {r.received} <span className={r.diff === 0 ? "text-muted-foreground" : "font-semibold"}>({r.diff > 0 ? "+" : ""}{r.diff})</span></span>
                  </li>))}</ul>
              </>
            )}
          </div>
          <ul className="space-y-2 md:hidden">
            {d.rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <span className="min-w-0 truncate font-medium">{r.name}</span>
                <span className={r.received ? "font-semibold" : "text-muted-foreground"}>{r.received}</span>
              </li>
            ))}
          </ul>
          <div className="table-scroll hidden md:block">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-2">{t({ en: "Agent", bn: "এজেন্ট" })}</th><th className="text-right">{t({ en: "Received", bn: "পেয়েছেন" })}</th><th className="text-right">{t({ en: "First", bn: "প্রথম" })}</th><th className="text-right">{t({ en: "Last", bn: "শেষ" })}</th></tr></thead>
              <tbody>{d.rows.map((r) => (
                <tr key={r.id} className="border-t"><td className="py-2 font-medium">{r.name}</td><td className={`text-right ${r.received ? "font-semibold" : "text-muted-foreground"}`}>{r.received}</td><td className="text-right">{time(r.firstAt)}</td><td className="text-right">{time(r.lastAt)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
