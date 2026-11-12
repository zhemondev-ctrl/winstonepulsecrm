import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { PreviewFlag } from "@/lib/distribution-preview";
import { previewDailyDistribution } from "@/lib/lead-pool.functions";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";

type Target = "auto" | "today" | "next";
type Preview = Awaited<ReturnType<typeof previewDailyDistribution>>;

function fmtDay(day: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}
function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}

/** LeadHub, read-only: what the morning distribution would give each desk. Nothing is assigned. */
export function DistributionDryRun() {
  const t = useT();
  const adminToken = useAdminToken();
  const previewFn = useServerFn(previewDailyDistribution);
  const [target, setTarget] = useState<Target>("auto");
  const q = useQuery({
    queryKey: ["distribution-dry-run", target, adminToken],
    queryFn: () => previewFn({ data: { adminToken, target } }),
    enabled: Boolean(adminToken),
  });

  const flagLabel = (f: PreviewFlag, backlog: number) =>
    f === "review_lock" ? t({ en: "HQ review lock → 0", bn: "HQ রিভিউ লক → ০" })
    : f === "net50_zero" ? t({ en: `Net-50: backlog ${backlog} → 0 new`, bn: `Net-50: বকেয়া ${backlog} → নতুন ০` })
    : f === "net50_reduced" ? t({ en: `Net-50: 50 − ${backlog}`, bn: `Net-50: ৫০ − ${backlog}` })
    : f === "already_full" ? t({ en: "already received", bn: "আগেই পেয়েছেন" })
    : t({ en: "pool too small", bn: "ডেটাবেজে লিড কম" });
  const tone = (f: PreviewFlag) =>
    f === "review_lock" || f === "net50_zero" ? "border-destructive/40 bg-destructive/10 text-destructive"
    : f === "pool_short" || f === "net50_reduced" ? "border-warning/50 bg-warning/15 text-foreground"
    : "border-border bg-muted text-muted-foreground";
  const Flags = ({ row }: { row: Preview["rows"][number] }) => (
    <span className="flex flex-wrap gap-1">
      {row.flags.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : row.flags.map((f) => (
        <span key={f} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone(f)}`}>{flagLabel(f, row.backlog)}</span>
      ))}
    </span>
  );

  return (
    <section className="card-elevated space-y-4 p-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t({ en: "Dry run — automatic distribution", bn: "ড্রাই রান — স্বয়ংক্রিয় বণ্টন" })}</h2>
            <p className="text-xs text-muted-foreground">
              {t({
                en: "What each desk would receive if the morning run happened now: quota, Net-50 backlog limit, HQ review lock and pool size. Nothing is assigned or saved.",
                bn: "সকালের বণ্টন এখন চললে প্রতিটি ডেস্ক কত পেত: কোটা, Net-50 বকেয়া সীমা, HQ রিভিউ লক ও ডেটাবেজের লিড। কিছুই দেওয়া বা সংরক্ষণ হয় না।",
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="dry-run-target">{t({ en: "Run day", bn: "বণ্টনের দিন" })}</label>
          <select id="dry-run-target" value={target} onChange={(e) => setTarget(e.target.value as Target)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="auto">{t({ en: "Next run", bn: "পরের বণ্টন" })}</option>
            <option value="today">{t({ en: "Today", bn: "আজ" })}</option>
            <option value="next">{t({ en: "Next open day", bn: "পরের কর্মদিবস" })}</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => void q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`mr-2 size-4 ${q.isFetching ? "animate-spin" : ""}`} />{t({ en: "Refresh", bn: "রিফ্রেশ" })}
          </Button>
        </div>
      </header>

      {!adminToken ? (
        <p className="text-sm text-muted-foreground">{t({ en: "Unlock LeadHub with its PIN to see the dry run.", bn: "ড্রাই রান দেখতে LeadHub পিন দিয়ে খুলুন।" })}</p>
      ) : q.isError ? (
        <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Unavailable"}</p>
      ) : q.isPending ? (
        <p className="text-sm text-muted-foreground">{t({ en: "Calculating…", bn: "হিসাব হচ্ছে…" })}</p>
      ) : (
        <Body data={q.data} t={t} Flags={Flags} />
      )}
    </section>
  );
}

function Body({ data, t, Flags }: { data: Preview; t: ReturnType<typeof useT>; Flags: (p: { row: Preview["rows"][number] }) => ReactNode }) {
  const tot = data.totals;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {t({ en: "Run day", bn: "বণ্টনের দিন" })}: <span className="font-semibold text-foreground">{fmtDay(data.day)}</span>
        {" · "}{t({ en: "measured", bn: "হিসাবের সময়" })} {fmtTime(data.measuredAt)}
        {" · "}{t({ en: "Net-50", bn: "Net-50" })} {data.cap.enabled ? t({ en: `on (limit ${data.cap.limit})`, bn: `চালু (সীমা ${data.cap.limit})` }) : t({ en: "off", bn: "বন্ধ" })}
      </p>
      {data.skippedPaused && (
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          {t({ en: "Paused clearance days are skipped — this is the first day the morning run will hand out leads.", bn: "স্থগিত দিনগুলো বাদ — এটি প্রথম দিন যেদিন সকালের বণ্টনে লিড দেওয়া হবে।" })}
        </p>
      )}
      {data.block && (
        <p className="rounded-lg border border-warning/50 bg-warning/15 px-3 py-2 text-xs">
          {data.block === "paused"
            ? t({ en: "Automatic distribution is paused on this day (backlog clearance). The morning run will hand out nothing.", bn: "এই দিনে স্বয়ংক্রিয় বণ্টন স্থগিত (বকেয়া পরিষ্কার)। সকালের বণ্টনে কিছু দেওয়া হবে না।" })
            : t({ en: "Friday — no distribution on this day.", bn: "শুক্রবার — এই দিনে বণ্টন নেই।" })}
        </p>
      )}
      {data.target === "next" && (
        <p className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          {t({
            en: "Backlog and review locks are today's values. Work done before the run lowers the backlog, and today's 10% review is measured after the day ends — the real run can differ.",
            bn: "বকেয়া ও রিভিউ লক আজকের মান। বণ্টনের আগে কাজ করলে বকেয়া কমবে, আর আজকের ১০% রিভিউ দিনশেষে মাপা হয় — আসল বণ্টন ভিন্ন হতে পারে।",
          })}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label={t({ en: "Would assign", bn: "দেওয়া হবে" })} value={String(tot.wouldAssign)} hint={`${t({ en: "pool", bn: "ডেটাবেজ" })} ${tot.pool}`} />
        <Stat label={t({ en: "Net-50: no new leads", bn: "Net-50: নতুন লিড নেই" })} value={String(tot.net50Zero)} warn={tot.net50Zero > 0} />
        <Stat label={t({ en: "Net-50: reduced", bn: "Net-50: কম" })} value={String(tot.net50Reduced)} hint={`−${tot.reducedBy}`} />
        <Stat label={t({ en: "HQ review locks", bn: "HQ রিভিউ লক" })} value={String(tot.lockedDesks)} warn={tot.lockedDesks > 0} />
      </div>
      {tot.shortfall > 0 && (
        <p className="rounded-lg border border-warning/50 bg-warning/15 px-3 py-2 text-xs">
          {t({ en: `The pool is ${tot.shortfall} leads short of today's need (${tot.need}).`, bn: `আজকের প্রয়োজন (${tot.need}) থেকে ডেটাবেজে ${tot.shortfall}টি লিড কম।` })}
        </p>
      )}

      <ul className="space-y-2 md:hidden">
        {data.rows.map((r) => (
          <li key={r.id} className="space-y-2 rounded-xl border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 font-semibold break-words">{r.name}</p>
              <span className="shrink-0 text-lg font-semibold tabular-nums">{r.wouldReceive}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">{t({ en: "Quota", bn: "কোটা" })}</dt><dd className="tabular-nums">{r.quota}</dd>
              <dt className="text-muted-foreground">{t({ en: "Older backlog", bn: "পুরোনো বকেয়া" })}</dt><dd className="tabular-nums">{r.backlog}</dd>
              <dt className="text-muted-foreground">{t({ en: "Allowed (Net-50)", bn: "সীমা (Net-50)" })}</dt><dd className="tabular-nums">{r.allowed}</dd>
              <dt className="text-muted-foreground">{t({ en: "Already received", bn: "আগেই পেয়েছেন" })}</dt><dd className="tabular-nums">{r.held}</dd>
            </dl>
            <Flags row={r} />
          </li>
        ))}
      </ul>
      <div className="table-scroll hidden rounded-xl border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{t({ en: "Agent", bn: "এজেন্ট" })}</th>
              <th className="px-3 py-2 text-right font-medium">{t({ en: "Quota", bn: "কোটা" })}</th>
              <th className="px-3 py-2 text-right font-medium">{t({ en: "Older backlog", bn: "পুরোনো বকেয়া" })}</th>
              <th className="px-3 py-2 text-right font-medium">{t({ en: "Allowed (Net-50)", bn: "সীমা (Net-50)" })}</th>
              <th className="px-3 py-2 text-right font-medium">{t({ en: "Already received", bn: "আগেই পেয়েছেন" })}</th>
              <th className="px-3 py-2 text-right font-medium">{t({ en: "Would receive", bn: "পাবেন" })}</th>
              <th className="px-3 py-2 font-medium">{t({ en: "Flags", bn: "সতর্কতা" })}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.quota}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.backlog}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.allowed}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.held}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.wouldReceive}</td>
                <td className="px-3 py-2"><Flags row={r} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {t({
          en: "Older backlog = pending company leads, not counting leads received on the run day; self-collected leads never count. The pool figure is before duplicate checks, so the real run can assign slightly fewer.",
          bn: "পুরোনো বকেয়া = অপেক্ষমাণ কোম্পানি লিড, বণ্টনের দিনে পাওয়া লিড বাদে; নিজস্ব লিড কখনো গণনায় নেই। ডেটাবেজের সংখ্যা ডুপ্লিকেট যাচাইয়ের আগের, তাই আসল বণ্টনে সামান্য কম যেতে পারে।",
        })}
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
