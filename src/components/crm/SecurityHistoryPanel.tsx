import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GitCompareArrows, History, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { readSecurityHistory } from "@/lib/security-history.functions";
import { compareSecurityEvidence, type SecurityEvidence } from "@/lib/security-history";

const date = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));

export function SecurityHistoryPanel() {
  const t = useT();
  const token = useAdminToken();
  const read = useServerFn(readSecurityHistory);
  const query = useQuery({ queryKey: ["security-history", token], queryFn: () => read({ data: { adminToken: token } }) });
  const [beforeId, setBeforeId] = useState("deep-20261114-145704");
  const [afterId, setAfterId] = useState("deep-request-e41e0544");
  const [kind, setKind] = useState("all");
  const rows = query.data ?? [];
  const before = rows.find(row => row.id === beforeId);
  const after = rows.find(row => row.id === afterId);
  const comparison = before && after ? compareSecurityEvidence(before, after) : null;
  const label = (row: SecurityEvidence) => `${date(row.recordedAt)} · ${row.kind} · ${row.revision ?? t({ en: "Unknown revision", bn: "সংস্করণ অজানা" })}`;
  const stateLabel = (row: SecurityEvidence) => row.state === "pending" ? t({ en: "Unconfirmed", bn: "অনিশ্চিত" }) : row.state === "stale" ? t({ en: "Outdated", bn: "পুরোনো" }) : t({ en: "Passed checks", bn: "পরীক্ষা সফল" });
  const evidence = (row: SecurityEvidence) => <div className="space-y-2 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono">{row.revision ?? t({ en: "Revision unknown", bn: "সংস্করণ অজানা" })}</span><span className={row.state === "passed" ? "text-live" : "text-warning"}>{stateLabel(row)}</span></div>
    <p className="text-muted-foreground">{t(row.summary)}</p>
    <p className="text-xs text-muted-foreground">{t({ en: "Observed", bn: "পর্যবেক্ষণ" })}: {date(row.recordedAt)} Dhaka{row.scanAt ? ` · Scan: ${date(row.scanAt)} Dhaka` : ""}</p>
    <p>{row.tests !== null ? `${row.tests} ${t({ en: "tests passed", bn: "পরীক্ষা সফল" })}` : row.critical !== null ? `${row.critical} ${t({ en: "critical findings recorded", bn: "গুরুতর সমস্যা নথিভুক্ত" })}` : t({ en: "Finding count not confirmed", bn: "সমস্যার সংখ্যা নিশ্চিত নয়" })}</p>
    {row.findings.map(f => <div key={f.id} className="border-l-2 border-border pl-3"><p>{t(f.title)}</p><p className="text-xs text-muted-foreground">{f.state === "reported" ? t({ en: "Reported in scan", bn: "স্ক্যানে পাওয়া" }) : t({ en: "Marked fixed · deep verification pending", bn: "সংশোধিত চিহ্নিত · গভীর যাচাই বাকি" })}</p></div>)}
  </div>;
  return <section className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
      <div className="space-y-1"><h2 className="flex items-center gap-2 text-xl font-semibold"><History className="size-5 text-gold" />{t({ en: "Security history", bn: "নিরাপত্তা পরীক্ষার ইতিহাস" })}</h2><p className="text-sm text-muted-foreground">{t({ en: "Recorded evidence · Dhaka time · Last observation: 14 Nov 2026, 21:11", bn: "নথিভুক্ত প্রমাণ · ঢাকা সময় · শেষ পর্যবেক্ষণ: ১৪ নভেম্বর ২০২৬, ২১:১১" })}</p></div>
      <Button variant="outline" size="icon" aria-label="Reload recorded history" title="Reload recorded history" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={`size-4 ${query.isFetching ? "animate-spin" : ""}`} /></Button>
    </header>
    {query.isPending ? <p role="status">{t({ en: "Loading history…", bn: "ইতিহাস আসছে…" })}</p> : query.isError ? <p role="alert" className="text-destructive">{t({ en: "History could not be loaded. Retry with the reload button.", bn: "ইতিহাস আনা যায়নি। আবার লোড করুন।" })}</p> : <>
      <div className="border-l-2 border-warning bg-warning/10 p-3 text-sm">{t({ en: "e41e0544: 51 tests passed; fresh deep-scan verification remains unconfirmed. These dated records are not live scan results.", bn: "e41e0544: ৫১টি পরীক্ষা সফল; নতুন গভীর স্ক্যানের যাচাই অনিশ্চিত। এগুলো তারিখভিত্তিক নথি, সরাসরি স্ক্যানের ফল নয়।" })}</div>
      <div className="grid gap-4 md:grid-cols-2">
        {[{ value: beforeId, set: setBeforeId, text: t({ en: "Earlier evidence", bn: "আগের প্রমাণ" }), row: before }, { value: afterId, set: setAfterId, text: t({ en: "Later evidence", bn: "পরের প্রমাণ" }), row: after }].map(item => <div key={item.text} className="min-w-0 space-y-3"><label className="block space-y-2 text-sm font-medium"><span>{item.text}</span><select className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm" value={item.value} onChange={e => item.set(e.target.value)}>{rows.map(row => <option key={row.id} value={row.id}>{label(row)}</option>)}</select></label>{item.row && evidence(item.row)}</div>)}
      </div>
      {comparison && <div className="flex items-start gap-2 border-y border-border py-3 text-sm"><GitCompareArrows className="mt-0.5 size-4 shrink-0 text-gold" /><p>{comparison.criticalDelta === null || !comparison.comparableScans ? t({ en: "No comparable finding-count change: pending scans, tests and basic checks do not prove deep-scan clearance.", bn: "সমস্যার সংখ্যার পরিবর্তন তুলনাযোগ্য নয়: অনিশ্চিত স্ক্যান, পৃথক পরীক্ষা বা প্রাথমিক পরীক্ষা গভীর স্ক্যানের ছাড়পত্র নয়।" }) : `${t({ en: "Recorded critical change", bn: "নথিভুক্ত গুরুতর পরিবর্তন" })}: ${comparison.criticalDelta > 0 ? "+" : ""}${comparison.criticalDelta}`}</p></div>}
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{t({ en: "Timeline", bn: "সময়ের ক্রম" })}</h3><select aria-label="Evidence type" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={kind} onChange={e => setKind(e.target.value)}><option value="all">{t({ en: "All evidence", bn: "সব প্রমাণ" })}</option><option value="deep">{t({ en: "Deep scans", bn: "গভীর স্ক্যান" })}</option><option value="basic">{t({ en: "Basic checks", bn: "প্রাথমিক পরীক্ষা" })}</option><option value="tests">{t({ en: "Regression tests", bn: "পৃথক পরীক্ষা" })}</option></select></div>
      <ol className="divide-y divide-border">{[...rows].reverse().filter(row => kind === "all" || row.kind === kind).map(row => <li key={row.id} className="grid gap-3 py-4 md:grid-cols-[180px_minmax(0,1fr)]"><div className="text-sm"><p className="font-medium">{date(row.recordedAt)} Dhaka</p><p className="text-muted-foreground">{row.kind}</p></div>{evidence(row)}</li>)}</ol>
    </>}
  </section>;
}