import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, PhoneOff, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bi } from "@/components/crm/Bi";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { dhakaDateOf } from "@/lib/business-day";
import { downloadCsv, toCsv } from "@/lib/crm-reports";
import { readClosureRecoveryQueue } from "@/lib/closure-recovery.functions";
import type { ClosureKind } from "@/lib/closure-attempts";

const ClosureRecoveryCharts = lazy(() => import("./ClosureRecoveryCharts"));
const PAGE = 25;
const KIND: Record<ClosureKind, { en: string; bn: string }> = {
  unreachable: { en: "Closed as unreachable", bn: "যোগাযোগ হয়নি বলে বন্ধ" },
  conversation: { en: "Closed after a claimed conversation", bn: "কথা হয়েছে দাবি করে বন্ধ" },
};
const GAP: Record<ClosureKind, { en: string; bn: string }> = {
  unreachable: { en: "fewer than 3 phone-recorded attempts", bn: "ফোনে রেকর্ড হওয়া চেষ্টা ৩টির কম" },
  conversation: { en: "no phone-proven conversation", bn: "ফোনে প্রমাণিত কথোপকথন নেই" },
};
const REASON: Record<string, { en: string; bn: string }> = {
  not_interested: { en: "Not interested", bn: "আগ্রহী নন" },
  wrong_number: { en: "Wrong number", bn: "ভুল নম্বর" },
  not_connected: { en: "Not connected", bn: "সংযোগ হয়নি" },
  no_contact: { en: "No contact", bn: "যোগাযোগ হয়নি" },
  info_completed: { en: "Information given", bn: "তথ্য দেওয়া হয়েছে" },
  other: { en: "Other", bn: "অন্যান্য" },
  no_answer: { en: "Did not receive", bn: "ধরেননি" },
};
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Executive HQ / IT, read-only review list. Never reopens, reassigns or edits a lead. */
export function ClosureRecoveryQueue({ onOpenLead }: { onOpenLead: (id: string) => void }) {
  const t = useT();
  const token = useAdminToken();
  const read = useServerFn(readClosureRecoveryQueue);
  const [from, setFrom] = useState(() => dhakaDateOf(Date.now() - 29 * 864e5));
  const [to, setTo] = useState(() => dhakaDateOf());
  const [agent, setAgent] = useState("all");
  const [kind, setKind] = useState<"all" | ClosureKind>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const valid = Boolean(from && to && from <= to && Date.parse(to) - Date.parse(from) < 92 * 864e5);
  const q = useQuery({ queryKey: ["closure-recovery", token ?? "session", from, to], queryFn: () => read({ data: { adminToken: token, from, to } }), enabled: valid, staleTime: 60_000 });
  const all = q.data?.rows ?? [];
  const agents = useMemo(() => {
    const m = new Map(all.map(r => [r.agentId ?? "none", r.agentName]));
    for (const c of q.data?.cells ?? []) { const id = c.agentId ?? "none"; if (!m.has(id)) m.set(id, (c.agentId && q.data?.agentNames[c.agentId]) || "Unknown agent"); }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [all, q.data]);
  const s = search.trim().toLowerCase();
  const rows = all.filter(r => (agent === "all" || (r.agentId ?? "none") === agent) && (kind === "all" || r.kind === kind) && (!s || `${r.name} ${r.agentName}`.toLowerCase().includes(s)));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE, current * PAGE + PAGE);
  const selectClass = "h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground";
  const exportCsv = () => downloadCsv(`closure-recovery-${from}-${to}.csv`, toCsv(
    ["closed_at_dhaka", "lead", "closing_agent", "closure_type", "close_reason", "reports_filed", "phone_recorded_attempts", "phone_proven_conversations", "required"],
    rows.map(r => [when(r.closedAt), r.name, r.agentName, r.kind, r.reason ?? r.category ?? "", r.reportedAttempts, r.verifiedAttempts, r.provenConversations, r.required]),
  ));
  const [pdfBusy, setPdfBusy] = useState(false);
  const exportWeeklyPdf = async () => {
    if (!q.data) return;
    setPdfBusy(true);
    try {
      const { buildWeeklyRecoveryPdf, weekWindow } = await import("@/lib/recovery-weekly-pdf");
      const w = weekWindow(from, to);
      const bytes = await buildWeeklyRecoveryPdf({
        cells: q.data.cells, agentNames: q.data.agentNames, from: w.from, to: w.to, generatedAt: new Date(),
        rows: q.data.rows.map((r) => ({ closedAt: r.closedAt, name: r.name, agentName: r.agentName, kind: r.kind, day: dhakaDateOf(Date.parse(r.closedAt)) })),
      });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = `recovery-review-week-${w.from}-${w.to}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } finally { setPdfBusy(false); }
  };
  const reset = () => setPage(0);
  const reasonLabel = (r: { reason: string | null; category: string | null }) => { const k = r.reason ?? r.category ?? ""; return REASON[k] ? t(REASON[k]) : k || "—"; };

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><PhoneOff className="size-5 shrink-0" /><Bi en="Closed without enough verified calls" bn="যথেষ্ট যাচাইকৃত কল ছাড়া বন্ধ হওয়া লিড" /></h2>
          <p className="mt-1 text-sm text-muted-foreground">{t({
            en: "Read-only review list. Unreachable closures need 3 phone-recorded attempts; other closures need one conversation the phone proved. Nothing here reopens, reassigns or changes a lead, and the closure rules stay as they are.",
            bn: "শুধু পর্যালোচনার তালিকা। 'যোগাযোগ হয়নি' বলে বন্ধ করতে ফোনে রেকর্ড হওয়া ৩টি চেষ্টা লাগে; অন্য কারণে বন্ধ করতে ফোনে প্রমাণিত একটি কথোপকথন লাগে। এখান থেকে কোনো লিড খোলা, পুনর্বণ্টন বা পরিবর্তন হয় না; বন্ধ করার নিয়মও বদলায় না।",
          })}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="icon" aria-label={t({ en: "Refresh", bn: "রিফ্রেশ" })} disabled={q.isFetching || !valid} onClick={() => void q.refetch()}><RefreshCw className={q.isFetching ? "animate-spin" : ""} /></Button>
          <Button variant="outline" disabled={!rows.length} onClick={exportCsv}><Download />CSV</Button>
          <Button variant="outline" disabled={!q.data || pdfBusy} onClick={() => void exportWeeklyPdf()} title={t({ en: "PDF of the 7 days ending on the 'to' date", bn: "শেষ তারিখ পর্যন্ত ৭ দিনের PDF" })}><FileText />{t({ en: "Weekly PDF", bn: "সাপ্তাহিক PDF" })}</Button>
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Input type="date" value={from} max={to} aria-label={t({ en: "From", bn: "শুরু" })} onChange={e => { setFrom(e.target.value); reset(); }} />
        <Input type="date" value={to} min={from} aria-label={t({ en: "To", bn: "শেষ" })} onChange={e => { setTo(e.target.value); reset(); }} />
        <select aria-label={t({ en: "Closing agent", bn: "বন্ধকারী এজেন্ট" })} className={selectClass} value={agent} onChange={e => { setAgent(e.target.value); reset(); }}>
          <option value="all">{t({ en: "All agents", bn: "সব এজেন্ট" })}</option>
          {agents.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select aria-label={t({ en: "Closure type", bn: "বন্ধের ধরন" })} className={selectClass} value={kind} onChange={e => { setKind(e.target.value as typeof kind); reset(); }}>
          <option value="all">{t({ en: "All closure types", bn: "সব ধরন" })}</option>
          {(Object.keys(KIND) as ClosureKind[]).map(k => <option key={k} value={k}>{t(KIND[k])}</option>)}
        </select>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" aria-label={t({ en: "Search lead or agent", bn: "লিড বা এজেন্ট খুঁজুন" })} placeholder={t({ en: "Lead / agent", bn: "লিড / এজেন্ট" })} value={search} onChange={e => { setSearch(e.target.value); reset(); }} /></div>
      </div>
      {!valid && <p role="alert" className="text-sm text-destructive">{t({ en: "Choose a range of at most 92 days, start before end.", bn: "সর্বোচ্চ ৯২ দিনের সময়সীমা বাছুন; শুরু শেষের আগে হতে হবে।" })}</p>}
      {q.isPending && valid && <p role="status" className="text-sm text-muted-foreground">{t({ en: "Checking closures against phone call records…", bn: "বন্ধ হওয়া লিড ফোনের কল রেকর্ডের সাথে মেলানো হচ্ছে…" })}</p>}
      {q.isError && <p role="alert" className="border-l-2 border-destructive pl-3 text-sm text-destructive">{t({ en: "Closure evidence could not be read. No partial list is shown — refresh to retry.", bn: "তথ্য পড়া যায়নি। আংশিক তালিকা দেখানো হচ্ছে না — আবার চেষ্টা করুন।" })}</p>}

      {q.data && !q.isError && <>
        <div className="grid grid-cols-2 gap-4 border-y border-border py-4 lg:grid-cols-4">
          {[
            { l: { en: "Closures checked", bn: "যাচাই করা বন্ধ লিড" }, v: q.data.totals.checked },
            { l: { en: "In review queue", bn: "পর্যালোচনার তালিকায়" }, v: q.data.totals.queued },
            { l: KIND.unreachable, v: q.data.totals.unreachable },
            { l: KIND.conversation, v: q.data.totals.conversation },
          ].map(x => <div key={x.l.en}><div className="text-xs text-muted-foreground">{t(x.l)}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{x.v}</div></div>)}
        </div>
        <p className="text-xs text-muted-foreground">{t({ en: "Sales and duplicate closures are not checked", bn: "বিক্রি ও ডুপ্লিকেট হিসেবে বন্ধ লিড যাচাইয়ের বাইরে" })} ({q.data.totals.outOfScope}). {t({ en: "Reports filed are the agent's own entries; only calls the phone recorded count as verified. A short count is a reason to review, not proof of fault.", bn: "রিপোর্ট এজেন্টের নিজের লেখা; শুধু ফোনে রেকর্ড হওয়া কলই যাচাইকৃত। কম সংখ্যা পর্যালোচনার কারণ, দোষের প্রমাণ নয়।" })} · {t({ en: "Read", bn: "পড়া হয়েছে" })} {when(q.data.readAt)}</p>

        <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">{t({ en: "Loading charts…", bn: "চার্ট লোড হচ্ছে…" })}</p>}>
          <ClosureRecoveryCharts cells={q.data.cells} agentNames={q.data.agentNames} from={from} to={to} agent={agent} kind={kind} kindLabel={KIND} />
        </Suspense>

        <ul className="space-y-3 md:hidden">
          {shown.map(r => <li key={r.leadId} className="rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground">{when(r.closedAt)} · {r.agentName}</div>
            <Button variant="link" className="h-auto whitespace-normal p-0 text-left font-semibold text-foreground" onClick={() => onOpenLead(r.leadId)}>{r.name}</Button>
            <div className="mt-1 text-xs text-muted-foreground">{reasonLabel(r)}</div>
            <div className="mt-1 text-sm">{t(KIND[r.kind])} — <span className="text-warning">{t(GAP[r.kind])}</span></div>
            <div className="mt-1 text-xs text-muted-foreground tabular-nums">{t({ en: "Reports", bn: "রিপোর্ট" })} {r.reportedAttempts} · {t({ en: "Phone attempts", bn: "ফোনে চেষ্টা" })} {r.verifiedAttempts} · {t({ en: "Proven talks", bn: "প্রমাণিত কথা" })} {r.provenConversations}</div>
          </li>)}
        </ul>
        <div className="table-scroll hidden md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground"><tr>
              {[{ en: "Closed (Dhaka)", bn: "বন্ধের সময়" }, { en: "Lead", bn: "লিড" }, { en: "Closing agent", bn: "বন্ধকারী এজেন্ট" }, { en: "Closure / gap", bn: "বন্ধের ধরন / ঘাটতি" }, { en: "Reports filed", bn: "রিপোর্ট" }, { en: "Phone attempts", bn: "ফোনে চেষ্টা" }, { en: "Proven talks", bn: "প্রমাণিত কথা" }].map(h => <th key={h.en} className="px-2 py-3 font-medium">{t(h)}</th>)}
            </tr></thead>
            <tbody>{shown.map(r => <tr key={r.leadId} className="border-b border-border">
              <td className="whitespace-nowrap px-2 py-3 text-xs">{when(r.closedAt)}</td>
              <td className="max-w-52 px-2 py-3"><Button variant="link" className="h-auto whitespace-normal p-0 text-left text-foreground" onClick={() => onOpenLead(r.leadId)}>{r.name}</Button><div className="text-xs text-muted-foreground">{reasonLabel(r)}</div></td>
              <td className="max-w-44 break-words px-2 py-3">{r.agentName}</td>
              <td className="max-w-60 px-2 py-3"><div>{t(KIND[r.kind])}</div><div className="text-xs text-warning">{t(GAP[r.kind])}</div></td>
              <td className="px-2 py-3 tabular-nums">{r.reportedAttempts}</td>
              <td className="px-2 py-3 tabular-nums">{r.verifiedAttempts}{r.kind === "unreachable" && <span className="text-muted-foreground"> / {r.required}</span>}</td>
              <td className="px-2 py-3 tabular-nums">{r.provenConversations}{r.kind === "conversation" && <span className="text-muted-foreground"> / {r.required}</span>}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {!rows.length && <p className="py-6 text-center text-sm text-muted-foreground">{t({ en: "No closures in this range are short of verified calls.", bn: "এই সময়ে যাচাইকৃত কলের ঘাটতিসহ কোনো বন্ধ লিড নেই।" })}</p>}
        {rows.length > PAGE && <div className="flex items-center justify-between gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>{t({ en: "Previous", bn: "আগের" })}</Button>
          <span className="tabular-nums text-muted-foreground">{current + 1} / {pages} · {rows.length}</span>
          <Button variant="outline" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>{t({ en: "Next", bn: "পরের" })}</Button>
        </div>}
      </>}
    </section>
  );
}
