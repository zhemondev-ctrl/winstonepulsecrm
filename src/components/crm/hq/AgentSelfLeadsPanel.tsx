import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { dhakaDateOf } from "@/lib/business-day";
import { readAgentSelfLeads } from "@/lib/agent-self-leads.functions";
import { downloadCsv, toCsv } from "@/lib/crm-reports";
import { isQualified } from "@/lib/agent-self-leads";

/** Read-only list of leads agents collected and added themselves (IT Console + HQ). */
export function AgentSelfLeadsPanel() {
  const t = useT();
  const token = useAdminToken();
  const read = useServerFn(readAgentSelfLeads);
  const [from, setFrom] = useState(() => dhakaDateOf(Date.now() - 29 * 864e5));
  const [to, setTo] = useState(() => dhakaDateOf());
  const [agent, setAgent] = useState("all");
  const [search, setSearch] = useState("");
  const valid = Boolean(from && to && from <= to);
  const q = useQuery({ queryKey: ["agent-self-leads", token ?? "session", from, to], queryFn: () => read({ data: { adminToken: token, from, to } }), enabled: valid, staleTime: 60_000 });
  const data = q.data;
  const s = search.trim().toLowerCase();
  const rows = (data?.rows ?? []).filter(r => (agent === "all" || r.agentId === agent) && (!s || (r.name ?? "").toLowerCase().includes(s) || r.agentName.toLowerCase().includes(s)));
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const exportCsv = () => downloadCsv(`own-leads-${from}-${to}.csv`, toCsv(rows.map(r => ({ agent: r.agentName, lead: r.name ?? "", phone: r.phone, added: r.createdAt, status: r.status ?? "", last_result: r.lastOutcome ?? "", temperature: r.temperature ?? "", follow_ups: r.followUps }))));

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><UserPlus className="size-5" />{t({ bn: "এজেন্টের নিজের সংগ্রহ করা লিড", en: "Agent own collected leads" })}</h2>
          <p className="text-sm text-muted-foreground">{t({ bn: "শুধু দেখা যায়। কোম্পানির ৫০টি কাজ বাধ্যতামূলক; নিজের যোগ্য (Hot/Warm) লিড অতিরিক্ত সাফল্য।", en: "Read-only. The 50 company tasks are mandatory; qualified (Hot/Warm) own leads are extra success." })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="w-auto" aria-label="From" />
          <Input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className="w-auto" aria-label="To" />
          <Button variant="outline" size="sm" onClick={() => q.refetch()} aria-label="Refresh"><RefreshCw className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}><Download className="size-4" />CSV</Button>
        </div>
      </header>
      {q.isLoading && <p className="text-sm text-muted-foreground">{t({ bn: "লোড হচ্ছে…", en: "Loading…" })}</p>}
      {q.error && <p role="alert" className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {data && <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.agents.map(a => (
            <button key={a.agentId} type="button" onClick={() => setAgent(agent === a.agentId ? "all" : a.agentId)} className={`rounded-xl border p-3 text-left ${agent === a.agentId ? "border-primary" : ""}`}>
              <div className="font-medium">{a.name}</div>
              <div className="mt-1 text-sm">{t({ bn: "আজ কোম্পানির কাজ", en: "Company tasks today" })}: <b className={a.companyComplete ? "text-success" : "text-destructive"}>{a.companyDoneToday}/{a.companyToday}</b></div>
              <div className="text-sm">{t({ bn: "নিজের লিড", en: "Own leads" })}: <b>{a.ownAdded}</b> · {t({ bn: "যোগ্য", en: "Qualified" })}: <b>{a.ownQualified}</b></div>
            </button>
          ))}
          {!data.agents.length && <p className="text-sm text-muted-foreground">{t({ bn: "কোনো তথ্য নেই।", en: "No data." })}</p>}
        </div>
        <Input placeholder={t({ bn: "লিড বা এজেন্ট খুঁজুন", en: "Search lead or agent" })} value={search} onChange={e => setSearch(e.target.value)} />
        <div className="space-y-2 md:hidden">
          {rows.map(r => <div key={r.id} className="rounded-xl border p-3 text-sm">
            <div className="font-medium">{r.name ?? "—"} <span className="text-muted-foreground">· {r.phone}</span></div>
            <div className="text-muted-foreground">{r.agentName} · {fmt(r.createdAt)}</div>
            <div>{r.status ?? "—"} · {r.lastOutcome ?? t({ bn: "কল হয়নি", en: "No call yet" })} · {r.temperature ?? "—"}{isQualified(r.temperature) ? " ✓" : ""} · FU {r.followUps}</div>
          </div>)}
        </div>
        <div className="table-scroll hidden md:block">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr>{[t({ bn: "এজেন্ট", en: "Agent" }), t({ bn: "লিড", en: "Lead" }), t({ bn: "ফোন", en: "Phone" }), t({ bn: "যোগের সময়", en: "Added" }), t({ bn: "অবস্থা", en: "Status" }), t({ bn: "শেষ কলের ফল", en: "Last call result" }), t({ bn: "মান", en: "Temperature" }), t({ bn: "ফলো-আপ", en: "Follow-ups" })].map(h => <th key={h} className="p-2 font-medium">{h}</th>)}</tr></thead>
            <tbody>{rows.map(r => <tr key={r.id} className="border-t">
              <td className="p-2">{r.agentName}</td><td className="p-2">{r.name ?? "—"}</td><td className="p-2 tabular-nums">{r.phone}</td>
              <td className="p-2">{fmt(r.createdAt)}</td><td className="p-2">{r.status ?? "—"}</td><td className="p-2">{r.lastOutcome ?? "—"}</td>
              <td className="p-2">{r.temperature ?? "—"}{isQualified(r.temperature) ? " ✓" : ""}</td><td className="p-2 tabular-nums">{r.followUps}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">{rows.length} {t({ bn: "টি লিড", en: "leads" })}</p>
      </>}
    </section>
  );
}
