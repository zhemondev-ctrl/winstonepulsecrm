import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { readAgentSourceTrend } from "@/lib/agent-sales-scorecard.functions";
import type { LeadSourceBucket } from "@/lib/agent-sales-scorecard";

const BUCKETS: LeadSourceBucket[] = ["companyDatabase", "selfAssigned", "unknownSource", "otherSource"];

export default function AgentSourceTrend({ agentId, name, from, to, onClose }: { agentId: string; name: string; from: string; to: string; onClose: () => void }) {
  const t = useT(), token = useAdminToken(), read = useServerFn(readAgentSourceTrend);
  const q = useQuery({ queryKey: ["agent-source-trend", token ?? "session", agentId, from, to], queryFn: () => read({ data: { adminToken: token, agentId, from, to } }), staleTime: 60_000 });
  const label: Record<LeadSourceBucket, string> = { companyDatabase: t({ bn: "কোম্পানি ডেটাবেজ", en: "Company database" }), selfAssigned: t({ bn: "নিজে যুক্ত", en: "Self-assigned" }), unknownSource: t({ bn: "উৎস অজানা", en: "Unknown source" }), otherSource: t({ bn: "অন্যান্য উৎস", en: "Other known source" }) };
  const config: ChartConfig = { companyDatabase: { label: label.companyDatabase, color: "var(--chart-1)" }, selfAssigned: { label: label.selfAssigned, color: "var(--chart-2)" }, unknownSource: { label: label.unknownSource, color: "var(--chart-4)" }, otherSource: { label: label.otherSource, color: "var(--chart-3)" } };
  const totals = BUCKETS.map(b => ({ bucket: b, value: q.data?.points.reduce((sum, p) => sum + p[b], 0) ?? 0 }));
  const undated = q.data ? BUCKETS.reduce((sum, b) => sum + q.data.undated[b], 0) : 0;
  const period = q.data?.granularity === "week" ? t({ bn: "সাপ্তাহিক (প্রথম দিন থেকে)", en: "Weekly (from first day)" }) : t({ bn: "দৈনিক", en: "Daily" });
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="sm:max-w-3xl">
    <DialogHeader><DialogTitle>{name} · {t({ bn: "উৎসভিত্তিক ট্রেন্ড", en: "Lead source trend" })}</DialogTitle><DialogDescription>{from} → {to} · Asia/Dhaka{q.data ? ` · ${period}` : ""}</DialogDescription></DialogHeader>
    <p className="text-xs text-muted-foreground">{t({ bn: "বর্তমান লিড, বর্তমান এজেন্টকে সর্বশেষ সংরক্ষিত অ্যাসাইনমেন্টের ঢাকা তারিখ অনুযায়ী।", en: "Current portfolio, dated by the latest saved assignment to this agent (Dhaka date)." })}</p>
    {q.isPending ? <p role="status">{t({ bn: "ট্রেন্ড লোড হচ্ছে…", en: "Loading trend…" })}</p> : q.isError ? <p role="alert" className="text-destructive">{t({ bn: "ট্রেন্ড পড়া যায়নি। আবার চেষ্টা করুন।", en: "Trend unavailable. Please refresh." })}</p> : <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{totals.map(({ bucket, value }) => <div key={bucket} className="min-w-0"><dt className="break-words text-xs text-muted-foreground">{label[bucket]}</dt><dd className="text-lg font-semibold tabular-nums">{value}</dd></div>)}</dl>
      {totals.every(x => x.value === 0) ? <p className="text-sm text-muted-foreground">{t({ bn: "এই সময়ে কোনো অ্যাসাইনমেন্ট নেই।", en: "No assignments in this period." })}</p> :
        <ChartContainer config={config} className="aspect-auto h-64 w-full" aria-label="Lead source trend chart"><BarChart data={q.data.points} margin={{ left: -16, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="period" tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} minTickGap={16} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
          {BUCKETS.map(b => <Bar key={b} dataKey={b} stackId="source" fill={`var(--color-${b})`} />)}
        </BarChart></ChartContainer>}
      <p className="text-xs text-muted-foreground">{t({ bn: "সংরক্ষিত অ্যাসাইনমেন্ট তারিখ নেই", en: "No saved assignment date" })}: <span className="tabular-nums">{undated}</span> · {t({ bn: "এই সময়ের বাইরে পাওয়া", en: "Received outside this period" })}: <span className="tabular-nums">{q.data.outsideRange}</span></p>
    </>}
  </DialogContent></Dialog>;
}