import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardList, Download } from "lucide-react";
import { useState } from "react";

import { DailyAuditCompare } from "@/components/crm/hq/DailyAuditCompare";
import { DemeritLog } from "@/components/crm/hq/DemeritLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dhakaDate } from "@/lib/accountability";
import { downloadCsv, toCsv } from "@/lib/crm-reports";
import { PENDING_THRESHOLD_PERCENT, teamTotals } from "@/lib/daily-audit";
import { getDailyAgentAudit } from "@/lib/daily-audit.functions";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";

type Row = Awaited<ReturnType<typeof getDailyAgentAudit>>["rows"][number];

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}

/** HQ + IT read-only daily audit: per-agent work measured against the 10% pending threshold. */
export function DailyAgentAudit() {
  const t = useT();
  const adminToken = useAdminToken();
  const fetchAudit = useServerFn(getDailyAgentAudit);
  const [day, setDay] = useState(() => dhakaDate(0));
  const q = useQuery({
    queryKey: ["daily-agent-audit", day, adminToken],
    queryFn: () => fetchAudit({ data: { adminToken, day } }),
    enabled: Boolean(adminToken) && /^\d{4}-\d{2}-\d{2}$/.test(day),
  });

  const exportCsv = () => {
    if (!q.data) return;
    const headers = ["Agent", "Employee ID", "Company leads assigned", "Received today (ledger)", "Active backlog now (older + today)", "Older pending backlog (now)", "Allowed today (Net-50)", "Follow-ups due", "Overdue follow-ups", "Calls logged", "Leads called", "Reports submitted", "Closed after answered call", "Converted", "Closed on unanswered call", "Incomplete reports", "Incomplete reports added to workload", "Pending", "Workload", "Pending %", "Over 10%", "Review status"];
    const rows = q.data.rows.map((r) => [r.name, r.employeeId ?? "", r.assigned, r.receivedToday, r.olderBacklog === null ? "" : r.olderBacklog + r.todayPendingLeads, r.olderBacklog ?? "", r.assignment?.allowed ?? "", r.dueFollowUps, r.overdueFollowUps, r.callsLogged, r.leadsCalled, r.reportsSubmitted, r.closedAnswered, r.converted, r.closedUnanswered, r.missedReports, r.incompleteReportsCounted, r.pending, r.eligible, r.pendingPercent, r.flagged ? "Yes" : "No", r.reviewStatus ?? ""]);
    downloadCsv(`daily-agent-audit-${q.data.day}.csv`, toCsv(headers, rows));
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <ClipboardList className="mt-1 size-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{t({ en: "Daily agent audit", bn: "দৈনিক এজেন্ট নিরীক্ষা" })}</h2>
            <p className="text-sm text-muted-foreground">
              {t({
                en: `Each agent's assigned leads, calls, follow-ups and overdue work for one Dhaka day. Pending % = work not done by end of day ÷ (company leads assigned + follow-ups due + call reports left unfinished). Above ${PENDING_THRESHOLD_PERCENT}% means an HQ review. View only — this page changes nothing.`,
                bn: `ঢাকা সময়ের একটি দিনে প্রতিটি এজেন্টের দেওয়া লিড, কল, ফলো-আপ ও বকেয়া কাজ। বাকি % = দিনশেষে না-করা কাজ ÷ (দেওয়া কোম্পানি লিড + নির্ধারিত ফলো-আপ + অসম্পূর্ণ কল রিপোর্ট)। ${PENDING_THRESHOLD_PERCENT}%-এর বেশি হলে HQ রিভিউ। শুধু দেখা — এই পাতা কিছু বদলায় না।`,
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="daily-audit-day">{t({ en: "Day", bn: "দিন" })}</label>
          <Input id="daily-audit-day" type="date" value={day} max={dhakaDate(0)} min="2026-09-28" onChange={(e) => setDay(e.target.value)} className="w-auto" />
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!q.data?.rows.length}><Download className="mr-2 size-4" />CSV</Button>
        </div>
      </div>

      {!adminToken ? (
        <p className="text-sm text-muted-foreground">{t({ en: "Unlock with your PIN to see the daily audit.", bn: "দৈনিক নিরীক্ষা দেখতে পিন দিয়ে খুলুন।" })}</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Unavailable"}</p>
      ) : q.isPending ? (
        <p className="text-sm text-muted-foreground">{t({ en: "Measuring…", bn: "হিসাব হচ্ছে…" })}</p>
      ) : (
        <AuditBody data={q.data} t={t} />
      )}
      <div className="border-t border-border pt-4"><DailyAuditCompare /></div>
      <div className="border-t border-border pt-4"><DemeritLog /></div>
    </section>
  );
}

function AuditBody({ data, t }: { data: Awaited<ReturnType<typeof getDailyAgentAudit>>; t: ReturnType<typeof useT> }) {
  const total = teamTotals(data.rows);
  const isToday = data.day === data.today;
  return (
    <div className="space-y-4">
      {!data.businessDay && (
        <p className="rounded-lg border border-warning/50 bg-warning/15 px-3 py-2 text-xs">{t({ en: "Not a business day (Friday/holiday) — no review is created for this day.", bn: "কর্মদিবস নয় (শুক্রবার/ছুটি) — এই দিনের জন্য কোনো রিভিউ হয় না।" })}</p>
      )}
      {isToday && (
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">{t({ en: "Today is still in progress — numbers are live and become final after the day ends.", bn: "আজকের দিন এখনো চলছে — সংখ্যাগুলো চলমান, দিন শেষে চূড়ান্ত হবে।" })}</p>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label={t({ en: "Agents over 10%", bn: "১০%-এর বেশি এজেন্ট" })} value={`${total.overThreshold}/${total.agents}`} warn={total.overThreshold > 0} />
        <Stat label={t({ en: "Team pending", bn: "দলের বাকি" })} value={`${total.pendingPercent}%`} hint={`${total.pending}/${total.eligible}`} warn={total.pendingPercent > PENDING_THRESHOLD_PERCENT} />
        <Stat label={t({ en: "Overdue follow-ups", bn: "বকেয়া ফলো-আপ" })} value={String(total.overdueFollowUps)} hint={`${t({ en: "of", bn: "মোট" })} ${total.dueFollowUps}`} />
        <Stat label={t({ en: "Calls logged / reports", bn: "কল / রিপোর্ট" })} value={`${total.callsLogged} / ${total.reportsSubmitted}`} />
      </div>

      {data.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t({ en: "No active agents.", bn: "কোনো সক্রিয় এজেন্ট নেই।" })}</p>
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {data.rows.map((r) => (
              <li key={r.agentId} className="space-y-2 rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-semibold break-words">{r.name}</p>
                  <Badge row={r} t={t} />
                </div>
                <AssignmentLine row={r} t={t} />
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">{t({ en: "Assigned today", bn: "আজ দেওয়া লিড" })}</dt><dd className="tabular-nums">{r.assigned}</dd>
                  <dt className="text-muted-foreground">{t({ en: "Active backlog (now)", bn: "মোট বকেয়া লিড (এখন)" })}</dt><dd className="tabular-nums"><BacklogValue row={r} /></dd>
                  <dt className="text-muted-foreground">{t({ en: "Follow-ups due / overdue", bn: "ফলো-আপ নির্ধারিত / বকেয়া" })}</dt><dd className="tabular-nums">{r.dueFollowUps} / {r.overdueFollowUps}</dd>
                  <dt className="text-muted-foreground">{t({ en: "Leads called / reports", bn: "কল করা লিড / রিপোর্ট" })}</dt><dd className="tabular-nums">{r.leadsCalled} / {r.reportsSubmitted}</dd>
                  <dt className="text-muted-foreground">{t({ en: "Closed (answered) / converted", bn: "বন্ধ (কথা হয়েছে) / রূপান্তর" })}</dt><dd className="tabular-nums">{r.closedAnswered} / {r.converted}</dd>
                  <dt className="text-muted-foreground">{t({ en: "Closed on unanswered call", bn: "কথা না হয়ে বন্ধ" })}</dt><dd className={`tabular-nums ${r.closedUnanswered ? "text-destructive" : ""}`}>{r.closedUnanswered}</dd>
                  <dt className="text-muted-foreground">{t({ en: "Incomplete reports", bn: "অসম্পূর্ণ রিপোর্ট" })}</dt><dd className="tabular-nums">{r.missedReports}</dd>
                  <dt className="text-muted-foreground">{t({ en: "Older follow-up backlog", bn: "পুরোনো বকেয়া ফলো-আপ" })}</dt><dd className="tabular-nums">{r.backlogFollowUps}</dd>
                </dl>
                <Details row={r} t={t} />
              </li>
            ))}
          </ul>
          <div className="table-scroll hidden rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t({ en: "Agent", bn: "এজেন্ট" })}</th>
                  <th className="px-3 py-2 text-right font-medium">{t({ en: "Assigned today", bn: "আজ দেওয়া" })}</th>
                  <th className="px-3 py-2 text-right font-medium">{t({ en: "Active backlog (now)", bn: "মোট বকেয়া (এখন)" })}</th>
                  <th className="px-3 py-2 text-right font-medium">{t({ en: "Follow-ups due / overdue", bn: "ফলো-আপ / বকেয়া" })}</th>
                  <th className="px-3 py-2 text-right font-medium">{t({ en: "Leads called / reports", bn: "কল করা লিড / রিপোর্ট" })}</th>
                  <th className="px-3 py-2 text-right font-medium">{t({ en: "Closed (answered) / converted", bn: "বন্ধ (কথা হয়েছে) / রূপান্তর" })}</th>
                  <th className="px-3 py-2 text-right font-medium">{t({ en: "Incomplete reports", bn: "অসম্পূর্ণ রিপোর্ট" })}</th>
                  <th className="px-3 py-2 text-right font-medium">{t({ en: "Pending / workload", bn: "বাকি / মোট কাজ" })}</th>
                  <th className="px-3 py-2 font-medium">{t({ en: "Pending %", bn: "বাকি %" })}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.agentId} className="border-t border-border align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium">{r.name}</p>
                      <AssignmentLine row={r} t={t} />
                      <Details row={r} t={t} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.assigned}</td>
                    <td className="px-3 py-2 text-right tabular-nums"><BacklogValue row={r} /></td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.dueFollowUps} / {r.overdueFollowUps}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.leadsCalled} / {r.reportsSubmitted}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.closedAnswered} / {r.converted}
                      {r.closedUnanswered > 0 && <p className="text-[11px] text-destructive">{r.closedUnanswered} {t({ en: "on unanswered call", bn: "কথা না হয়ে" })}</p>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.missedReports}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.pending} / {r.eligible}</td>
                    <td className="px-3 py-2"><Badge row={r} t={t} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        {t({ en: "Recalculated from saved CRM records at", bn: "সংরক্ষিত CRM রেকর্ড থেকে হিসাব করা হয়েছে" })} {fmtTime(data.measuredAt)}. {t({ en: "Self-collected leads are not part of the 50 company tasks and are excluded. Follow-ups whose responsibility is unconfirmed are not counted as overdue. Leads called = distinct leads with a call report started that day (saved call start; older reports use the time the report opened). Incomplete report = started that day and not submitted by its end; it adds to the workload unless that lead is already counted as pending. Closed (answered) uses the agent's answered-call mark, not phone proof. Active backlog and the Net-50 allowance are current values, shown for today only.", bn: "নিজস্ব লিড কোম্পানির ৫০টি কাজের অংশ নয়, তাই বাদ। দায় নিশ্চিত নয় এমন ফলো-আপ বকেয়া ধরা হয় না। কল করা লিড = সেদিন শুরু হওয়া কল রিপোর্টের আলাদা লিড (সংরক্ষিত কল শুরুর সময়; পুরোনো রিপোর্টে রিপোর্ট খোলার সময়)। অসম্পূর্ণ রিপোর্ট = সেদিন শুরু, দিনশেষে জমা হয়নি; একই লিড আগে থেকেই বাকি হিসেবে না থাকলে মোট কাজে যোগ হয়। 'কথা হয়েছে' এজেন্টের দেওয়া চিহ্ন, ফোনের প্রমাণ নয়। মোট বকেয়া ও Net-50 সীমা বর্তমান মান, শুধু আজকের জন্য দেখানো হয়।" })}
      </p>
    </div>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${warn ? "border-destructive/40 bg-destructive/10" : "border-border bg-background"}`}>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}{hint ? ` · ${hint}` : ""}</p>
    </div>
  );
}

function Badge({ row, t }: { row: Row; t: ReturnType<typeof useT> }) {
  const tone = row.flagged ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-success/40 bg-success/15 text-foreground";
  const review = row.reviewStatus === "approved" ? t({ en: "review approved", bn: "রিভিউ অনুমোদিত" }) : row.reviewStatus === "hold" ? t({ en: "on hold", bn: "স্থগিত" }) : row.reviewStatus ? t({ en: "review open", bn: "রিভিউ খোলা" }) : null;
  return (
    <span className="inline-flex flex-col items-end gap-0.5 md:items-start">
      <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${tone}`}>
        {row.pendingPercent}% {row.flagged ? t({ en: "over 10%", bn: "১০%-এর বেশি" }) : t({ en: "within", bn: "সীমার মধ্যে" })}
      </span>
      {review && <span className="text-[11px] text-muted-foreground">{review}</span>}
    </span>
  );
}

function Details({ row, t }: { row: Row; t: ReturnType<typeof useT> }) {
  if (!row.overdueList.length && !row.excludedFollowUps && !row.backlogFollowUps) return null;
  return (
    <details className="mt-1 text-xs">
      <summary className="cursor-pointer text-primary">{t({ en: "Overdue details", bn: "বকেয়ার বিস্তারিত" })}</summary>
      <div className="mt-1 space-y-1 text-muted-foreground">
        {row.overdueList.length > 0 && (
          <ul className="space-y-0.5">
            {row.overdueList.map((f) => <li key={f.id}>{f.customer ?? "—"} · {fmtTime(f.scheduledAt)}</li>)}
          </ul>
        )}
        {row.excludedFollowUps > 0 && <p>{t({ en: "Not counted (responsibility unconfirmed):", bn: "গণনায় নেই (দায় অনিশ্চিত):" })} {row.excludedFollowUps}</p>}
        {row.backlogFollowUps > 0 && <p>{t({ en: "Older backlog, shown separately:", bn: "পুরোনো বকেয়া, আলাদা দেখানো:" })} {row.backlogFollowUps}</p>}
      </div>
    </details>
  );
}

function AssignmentLine({ row, t }: { row: Row; t: ReturnType<typeof useT> }) {
  if (!row.assignment) return null;
  const { allowed, reason } = row.assignment;
  const why =
    reason === "review_lock" ? t({ en: "blocked: HQ review not approved", bn: "বন্ধ: HQ রিভিউ অনুমোদন হয়নি" })
    : reason === "paused" ? t({ en: "blocked: auto-distribution paused today", bn: "বন্ধ: আজ স্বয়ংক্রিয় বণ্টন স্থগিত" })
    : reason === "not_business_day" ? t({ en: "no distribution: holiday", bn: "বণ্টন নেই: ছুটি" })
    : reason === "backlog_full" ? t({ en: `backlog ${row.olderBacklog} ≥ 50`, bn: `বকেয়া ${row.olderBacklog} ≥ ৫০` })
    : reason === "backlog_reduced" ? t({ en: `50 − backlog ${row.olderBacklog}`, bn: `৫০ − বকেয়া ${row.olderBacklog}` })
    : t({ en: "full daily quota", bn: "পূর্ণ দৈনিক কোটা" });
  return (
    <p className="text-[11px] text-muted-foreground">
      {t({ en: "Received today", bn: "আজ পেয়েছেন" })} {row.receivedToday} · {t({ en: "allowed now", bn: "এখন সীমা" })} {allowed} ({why})
    </p>
  );
}

function BacklogValue({ row }: { row: Row }) {
  if (row.olderBacklog === null) return <>—</>;
  return (
    <span title={`${row.olderBacklog} + ${row.todayPendingLeads}`}>
      {row.olderBacklog + row.todayPendingLeads}
      <span className="block text-[11px] text-muted-foreground">{row.olderBacklog} + {row.todayPendingLeads}</span>
    </span>
  );
}
