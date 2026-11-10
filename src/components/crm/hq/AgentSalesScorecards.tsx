import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChartColumn, Download, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bi } from "@/components/crm/Bi";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { dhakaDateOf } from "@/lib/business-day";
import { readAgentSalesScorecards } from "@/lib/agent-sales-scorecard.functions";
import { downloadCsv, toCsv } from "@/lib/crm-reports";

import type { AgentSalesScorecard, LeadSourceBucket } from "@/lib/agent-sales-scorecard";
const AgentSourceLeadList = lazy(() => import("./AgentSourceLeadList"));
const AgentSourceTrend = lazy(() => import("./AgentSourceTrend"));

export function AgentSalesScorecards() {
  const t = useT();
  const token = useAdminToken();
  const read = useServerFn(readAgentSalesScorecards);
  const [from,setFrom] = useState(() => dhakaDateOf(Date.now()-29*864e5));
  const [to,setTo] = useState(() => dhakaDateOf());
  const [search,setSearch] = useState("");
  const valid = Boolean(from && to && from <= to && Date.parse(to)-Date.parse(from)<92*864e5);
  const q = useQuery({ queryKey:["agent-sales-scorecards",token ?? "session",from,to], queryFn:()=>read({data:{adminToken:token,from,to}}), enabled:valid, staleTime:60_000 });
  const rows = q.data?.rows.filter(r=>r.name.toLowerCase().includes(search.trim().toLowerCase())) ?? [];
  const labels = { assigned:t({bn:"বর্তমান লিড",en:"Current portfolio"}),converted:t({bn:"অনুমোদিত বুকিং লিড",en:"Approved booked leads"}),visits:t({bn:"ভিজিট বুকিং",en:"Visit bookings"}),lost:t({bn:"হারানো হট লিড",en:"Hot leads lost"}),rate:t({bn:"কনভার্সন হার",en:"Conversion rate"}) };
  const [selected, setSelected] = useState<{agentId:string;name:string;bucket:LeadSourceBucket;label:string}|null>(null);
  const [trend, setTrend] = useState<{agentId:string;name:string}|null>(null);
  const trendButton = (r: AgentSalesScorecard) => <Button variant="outline" size="sm" className="shrink-0" aria-label={`${r.name} · Lead source trend`} onClick={() => setTrend({agentId:r.agentId,name:r.name})}><ChartColumn className="size-4"/>{t({bn:"ট্রেন্ড",en:"Trend"})}</Button>;
  const buckets: LeadSourceBucket[] = ["companyDatabase","selfAssigned","unknownSource","otherSource"];
  const sourceLabels = [t({bn:"কোম্পানি ডেটাবেজ",en:"Company database"}),t({bn:"নিজে যুক্ত",en:"Self-assigned"}),t({bn:"উৎস অজানা",en:"Unknown source"}),t({bn:"অন্যান্য উৎস",en:"Other known source"})];
  const sourceButton = (r: AgentSalesScorecard, index:number) => {
    const bucket = buckets[index];
    const label = sourceLabels[index];
    if (!bucket || !label) return null;
    return <Button variant="link" className="h-10 min-w-10 p-0 font-semibold tabular-nums underline underline-offset-4" aria-label={`${r.name} · ${label} · ${r[bucket]}`} onClick={() => setSelected({agentId:r.agentId,name:r.name,bucket,label})}>{r[bucket]}</Button>;
  };
  const rate = (n:number|null)=>n===null?"—":`${n.toFixed(1)}%`;
  return <section className="space-y-4 border-b border-border pb-6" aria-label="Agent sales scorecards">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-xl font-semibold"><TrendingUp className="size-5 text-primary"/><Bi en="Agent sales scorecards" bn="এজেন্টের বিক্রয় স্কোরকার্ড"/></h2><p className="mt-1 text-xs text-muted-foreground">{from} → {to} · Asia/Dhaka</p></div>
      <div className="flex gap-2">
        <Button variant="outline" size="icon" title="Refresh scorecards" aria-label="Refresh scorecards" disabled={q.isFetching||!valid} onClick={()=>void q.refetch()}><RefreshCw className="size-4"/></Button>
        <Button variant="outline" size="icon" title="Download scorecards" aria-label="Download scorecards" disabled={!rows.length||q.isError||!valid} onClick={()=>downloadCsv(`agent-sales-scorecards_${from}_${to}.csv`,toCsv(["Agent","Current portfolio","Approved booked leads","Conversion %","Visit bookings","Confirmed hot leads lost","From (Dhaka)","To (Dhaka)","Read at","Company database","Self-assigned","Unknown source","Other known source"],rows.map(r=>[r.name,r.assigned,r.converted,r.conversionRate??"",r.visits,r.hotLost,from,to,q.data?.generatedAt??"",r.companyDatabase,r.selfAssigned,r.unknownSource,r.otherSource])))}><Download className="size-4"/></Button>
      </div>
    </header>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-xs">{t({bn:"থেকে",en:"From"})}<Input aria-label="Scorecard from date" type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label>
      <label className="text-xs">{t({bn:"পর্যন্ত",en:"To"})}<Input aria-label="Scorecard to date" type="date" value={to} max={dhakaDateOf()} onChange={e=>setTo(e.target.value)}/></label>
      <label className="text-xs">{t({bn:"এজেন্ট",en:"Agent"})}<Input aria-label="Search scorecard agents" value={search} onChange={e=>setSearch(e.target.value)} placeholder={t({bn:"নাম খুঁজুন",en:"Search name"})}/></label>
    </div>
    <dl className="grid gap-2 text-xs text-muted-foreground">
      <div><dt className="inline font-medium text-foreground">{labels.rate}: </dt><dd className="inline">{t({bn:"এই সময়ে HQ-অনুমোদিত বুকিং হওয়া আলাদা লিড ÷ বর্তমানে এজেন্টের মোট লিড।",en:"Distinct HQ-approved booked leads in this period ÷ the agent’s current portfolio."})}</dd></div>
      <div><dt className="inline font-medium text-foreground">{labels.visits}: </dt><dd className="inline">{t({bn:"এই সময়ে সংরক্ষিত, বাতিল নয় এমন ভিজিট অ্যাপয়েন্টমেন্ট।",en:"Saved non-cancelled visit appointments created in this period."})}</dd></div>
      <div><dt className="inline font-medium text-foreground">{labels.lost}: </dt><dd className="inline">{t({bn:"একই এজেন্টের আগের Hot রিপোর্ট, এরপর এই সময়ে সর্বশেষ ‘আগ্রহী নয়’ রিপোর্ট এবং বর্তমানে বন্ধ লিড। নিষ্ক্রিয়তা বা ফোন না ধরা ক্ষতি নয়।",en:"Prior Hot report by the same agent, followed by a latest not-interested report in this period and a currently closed lead. Inactivity and unanswered calls are not losses."})}</dd></div>
    </dl>
    {!valid?<p role="alert" className="text-sm text-destructive">{t({bn:"সঠিক ক্রমে সর্বোচ্চ ৯২ দিনের তারিখ দিন।",en:"Choose dates in order, at most 92 days."})}</p>:q.isPending?<p role="status" className="text-sm text-muted-foreground">{t({bn:"স্কোরকার্ড লোড হচ্ছে…",en:"Loading scorecards…"})}</p>:q.isError?<p role="alert" className="text-sm text-destructive">{t({bn:"স্কোরকার্ড পড়া যায়নি। আবার চেষ্টা করুন।",en:"Scorecards unavailable. Please refresh."})}</p>:<>
      <p className="text-xs text-muted-foreground">{t({bn:"তথ্য পড়া হয়েছে",en:"Evidence read"})}: {q.data?.generatedAt?new Date(q.data.generatedAt).toLocaleString("en-GB",{timeZone:"Asia/Dhaka"}):"—"} · {t({bn:"বর্তমান মালিকানায় হিসাব; ট্রান্সফারের আগের এজেন্টকে দায়ী নয়।",en:"Current ownership attribution; transferred leads are not blamed on former agents."})}</p>
      {!rows.length?<p className="text-sm text-muted-foreground">{t({bn:"কোনো এজেন্ট পাওয়া যায়নি।",en:"No agents match."})}</p>:<>
        <ul className="grid gap-3 md:hidden">{rows.map(r=><li key={r.agentId} className="rounded-lg border border-border bg-card p-3"><div className="flex items-start justify-between gap-2"><h3 className="min-w-0 break-words text-sm font-semibold">{r.name}</h3>{trendButton(r)}</div><div className="mt-2 flex items-baseline justify-between gap-2"><span className="text-xs text-muted-foreground">{labels.rate}</span><strong className="tabular-nums text-2xl">{rate(r.conversionRate)}</strong></div><dl className="mt-3 grid grid-cols-2 gap-3 text-xs">{[[labels.assigned,r.assigned],[labels.converted,r.converted],[labels.visits,r.visits],[labels.lost,r.hotLost],[t({bn:"কোম্পানি ডেটাবেজ",en:"Company database"}),r.companyDatabase],[t({bn:"নিজে যুক্ত",en:"Self-assigned"}),r.selfAssigned],[t({bn:"উৎস অজানা",en:"Unknown source"}),r.unknownSource],[t({bn:"অন্যান্য উৎস",en:"Other known source"}),r.otherSource]].map(([label,value],i)=><div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{i>=4?sourceButton(r,i-4):value}</dd></div>)}</dl></li>)}</ul>
        <div className="table-scroll hidden md:block"><table className="w-full min-w-[1150px] text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="py-3 text-left">{t({bn:"এজেন্ট",en:"Agent"})}</th>{[labels.assigned,labels.converted,labels.rate,labels.visits,labels.lost,t({bn:"কোম্পানি ডেটাবেজ",en:"Company database"}),t({bn:"নিজে যুক্ত",en:"Self-assigned"}),t({bn:"উৎস অজানা",en:"Unknown source"}),t({bn:"অন্যান্য উৎস",en:"Other known source"})].map(l=><th key={l} className="px-2 py-3 text-right font-medium">{l}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.agentId} className="border-b border-border"><td className="py-3 font-medium"><div className="flex items-center justify-between gap-2"><span className="min-w-0 break-words">{r.name}</span>{trendButton(r)}</div></td>{[r.assigned,r.converted,rate(r.conversionRate),r.visits,r.hotLost,r.companyDatabase,r.selfAssigned,r.unknownSource,r.otherSource].map((value,i)=><td key={i} className="px-2 py-3 text-right tabular-nums">{i>=5?sourceButton(r,i-5):value}</td>)}</tr>)}</tbody></table></div>
      </>}
    </>}
    {selected && <Suspense fallback={<p role="status">{t({bn:"লিড লোড হচ্ছে…",en:"Loading leads…"})}</p>}><AgentSourceLeadList key={`${selected.agentId}:${selected.bucket}`} {...selected} onClose={() => setSelected(null)} /></Suspense>}
    {trend && valid && <Suspense fallback={<p role="status">{t({bn:"ট্রেন্ড লোড হচ্ছে…",en:"Loading trend…"})}</p>}><AgentSourceTrend key={`${trend.agentId}:${from}:${to}`} {...trend} from={from} to={to} onClose={() => setTrend(null)} /></Suspense>}
  </section>;
}