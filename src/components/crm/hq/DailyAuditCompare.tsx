import { useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarRange, Download } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dhakaDate } from "@/lib/accountability";
import { downloadCsv, toCsv } from "@/lib/crm-reports";
import { compareDays, MAX_COMPARE_DAYS, PENDING_THRESHOLD_PERCENT } from "@/lib/daily-audit";
import { getDailyAgentAudit } from "@/lib/daily-audit.functions";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";

type Audit = Awaited<ReturnType<typeof getDailyAgentAudit>>;
type Row = Audit["rows"][number];
type Metric = "pendingPercent" | "assigned" | "leadsCalled" | "reportsSubmitted" | "missedReports" | "overdueFollowUps" | "closedAnswered" | "closedUnanswered";

const METRICS: { id: Metric; en: string; bn: string }[] = [
  { id: "pendingPercent", en: "Pending %", bn: "বাকি %" },
  { id: "assigned", en: "Assigned leads", bn: "দেওয়া লিড" },
  { id: "leadsCalled", en: "Leads called", bn: "কল করা লিড" },
  { id: "reportsSubmitted", en: "Reports submitted", bn: "জমা রিপোর্ট" },
  { id: "missedReports", en: "Incomplete reports", bn: "অসম্পূর্ণ রিপোর্ট" },
  { id: "overdueFollowUps", en: "Overdue follow-ups", bn: "বকেয়া ফলো-আপ" },
  { id: "closedAnswered", en: "Closed (answered)", bn: "বন্ধ (কথা হয়েছে)" },
  { id: "closedUnanswered", en: "Closed on unanswered call", bn: "কথা না হয়ে বন্ধ" },
];

function shortDay(day: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

/** Read-only: the same daily audit, one request per selected day, side by side per agent. */
export function DailyAuditCompare() {
  const t = useT();
  const adminToken = useAdminToken();
  const fetchAudit = useServerFn(getDailyAgentAudit);
  const today = dhakaDate(0);
  const [from, setFrom] = useState(() => dhakaDate(-4));
  const [to, setTo] = useState(today);
  const [metric, setMetric] = useState<Metric>("pendingPercent");
  const days = useMemo(() => compareDays(from, to, today), [from, to, today]);
  const lastDay = days[days.length - 1];
  const tooMany = lastDay !== undefined && to > lastDay;

  const results = useQueries({
    queries: days.map((day) => ({
      queryKey: ["daily-agent-audit", day, adminToken],
      queryFn: () => fetchAudit({ data: { adminToken, day } }),
      enabled: Boolean(adminToken),
      staleTime: 60_000,
    })),
  });
  const loading = results.some((r) => r.isPending);
  const failed = results.find((r) => r.isError);

  const agents = useMemo(() => {
    const byAgent = new Map<string, { name: string; cells: Map<string, Row> }>();
    results.forEach((r, i) => {
      const day = days[i];
      if (!day) return;
      for (const row of r.data?.rows ?? []) {
        const entry = byAgent.get(row.agentId) ?? { name: row.name, cells: new Map<string, Row>() };
        entry.cells.set(day, row);
        byAgent.set(row.agentId, entry);
      }
    });
    return [...byAgent.entries()]
      .map(([agentId, v]) => ({
        agentId,
        name: v.name,
        cells: v.cells,
        overDays: [...v.cells.values()].filter((c) => c.flagged).length,
        // Summed work for the window, never an average of daily percentages.
        windowPercent: (() => {
          const rows = [...v.cells.values()];
          const eligible = rows.reduce((n, c) => n + c.eligible, 0);
          const pending = rows.reduce((n, c) => n + c.pending, 0);
          return eligible === 0 ? 0 : Math.round((pending / eligible) * 1000) / 10;
        })(),
        total: [...v.cells.values()].reduce((n, c) => n + Number(c[metric]), 0),
      }))
      .sort((a, b) => b.overDays - a.overDays || b.windowPercent - a.windowPercent || a.name.localeCompare(b.name));
  }, [results, days, metric]);

  const label = (m: Metric) => { const x = METRICS.find((y) => y.id === m)!; return t({ en: x.en, bn: x.bn }); };
  const cell = (row: Row | undefined) => (row ? (metric === "pendingPercent" ? `${row.pendingPercent}%` : String(row[metric])) : "—");
  const tone = (row: Row | undefined) => (metric === "pendingPercent" && row?.flagged ? "text-destructive font-semibold" : "");
  const summary = (a: (typeof agents)[number]) => (metric === "pendingPercent" ? `${a.windowPercent}%` : String(a.total));

  const exportCsv = () => {
    const headers = ["Agent", ...days, metric === "pendingPercent" ? "Window pending %" : "Window total", `Days over ${PENDING_THRESHOLD_PERCENT}%`];
    const rows = agents.map((a) => [a.name, ...days.map((d) => cell(a.cells.get(d))), summary(a), a.overDays]);
    downloadCsv(`daily-audit-compare-${metric}-${days[0]}-${days[days.length - 1]}.csv`, toCsv(headers, rows));
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <CalendarRange className="mt-1 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold">{t({ en: "Compare dates", bn: "তারিখ মিলিয়ে দেখুন" })}</h3>
            <p className="text-sm text-muted-foreground">
              {t({
                en: `The same daily audit for up to ${MAX_COMPARE_DAYS} days, side by side. Window % adds up the work of all days, it is not an average of daily percentages.`,
                bn: `একই দৈনিক নিরীক্ষা সর্বোচ্চ ${MAX_COMPARE_DAYS} দিন পাশাপাশি। সময়কালের % সব দিনের কাজ যোগ করে হিসাব — দৈনিক % এর গড় নয়।`,
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="audit-compare-from">{t({ en: "From", bn: "থেকে" })}</label>
          <Input id="audit-compare-from" type="date" value={from} min="2026-09-28" max={today} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          <span className="text-xs text-muted-foreground">→</span>
          <label className="sr-only" htmlFor="audit-compare-to">{t({ en: "To", bn: "পর্যন্ত" })}</label>
          <Input id="audit-compare-to" type="date" value={to} min="2026-09-28" max={today} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          <label className="sr-only" htmlFor="audit-compare-metric">{t({ en: "Measure", bn: "মাপ" })}</label>
          <select id="audit-compare-metric" value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            {METRICS.map((m) => <option key={m.id} value={m.id}>{t({ en: m.en, bn: m.bn })}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || !agents.length}><Download className="mr-2 size-4" />CSV</Button>
        </div>
      </div>

      {!adminToken ? null : days.length === 0 ? (
        <p className="text-sm text-destructive">{t({ en: "Choose a start date on or before the end date, from 28 Sep 2026 to today.", bn: "শুরুর তারিখ শেষের তারিখের আগে বা একই দিনে দিন, ২৮ সেপ্টেম্বর ২০২৬ থেকে আজ পর্যন্ত।" })}</p>
      ) : failed ? (
        <p className="text-sm text-destructive">{failed.error instanceof Error ? failed.error.message : "Unavailable"}</p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">{t({ en: `Measuring ${days.length} days…`, bn: `${days.length} দিনের হিসাব হচ্ছে…` })}</p>
      ) : (
        <>
          {tooMany && <p className="text-xs text-muted-foreground">{t({ en: `Showing the first ${MAX_COMPARE_DAYS} days of the range.`, bn: `সময়সীমার প্রথম ${MAX_COMPARE_DAYS} দিন দেখানো হচ্ছে।` })}</p>}
          <ul className="space-y-2 md:hidden">
            {agents.map((a) => (
              <li key={a.agentId} className="space-y-2 rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-semibold break-words">{a.name}</p>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{summary(a)} · {a.overDays} {t({ en: "days over 10%", bn: "দিন ১০%-এর বেশি" })}</span>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {days.map((d) => (
                    <div key={d} className="contents">
                      <dt className="text-muted-foreground">{shortDay(d)}</dt>
                      <dd className={`tabular-nums ${tone(a.cells.get(d))}`}>{cell(a.cells.get(d))}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          <div className="table-scroll hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">{label(metric)}</caption>
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t({ en: "Agent", bn: "এজেন্ট" })}</th>
                  {days.map((d) => <th key={d} className="px-3 py-2 text-right font-medium whitespace-nowrap">{shortDay(d)}</th>)}
                  <th className="px-3 py-2 text-right font-medium">{metric === "pendingPercent" ? t({ en: "Window %", bn: "সময়কালের %" }) : t({ en: "Total", bn: "মোট" })}</th>
                  <th className="px-3 py-2 text-right font-medium">{t({ en: "Days over 10%", bn: "১০%-এর বেশি দিন" })}</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.agentId} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{a.name}</td>
                    {days.map((d) => <td key={d} className={`px-3 py-2 text-right tabular-nums ${tone(a.cells.get(d))}`}>{cell(a.cells.get(d))}</td>)}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{summary(a)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${a.overDays ? "text-destructive" : ""}`}>{a.overDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">{t({ en: "Fridays and holidays are shown but never create a review. Rows list today's active agents.", bn: "শুক্রবার ও ছুটির দিন দেখানো হয়, কিন্তু রিভিউ তৈরি হয় না। তালিকায় বর্তমানের সক্রিয় এজেন্টরা আছেন।" })}</p>
        </>
      )}
    </section>
  );
}
