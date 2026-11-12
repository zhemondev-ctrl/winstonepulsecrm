import { Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Line, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Bi } from "@/components/crm/Bi";
import { useT } from "@/lib/i18n";
import type { ClosureKind } from "@/lib/closure-attempts";
import { byAgent, byDate, byKind, filterCells, missingRate, type ClosureCell } from "@/lib/closure-recovery-charts";

type Label = { en: string; bn: string };

/** Read-only charts for the closure recovery review. Counts come from the same read as the list. */
export default function ClosureRecoveryCharts({ cells, agentNames, from, to, agent, kind, kindLabel }: {
  cells: ClosureCell[]; agentNames: Record<string, string>; from: string; to: string;
  agent: string; kind: "all" | ClosureKind; kindLabel: Record<ClosureKind, Label>;
}) {
  const t = useT();
  const scoped = filterCells(cells, agent, kind);
  const checked = scoped.reduce((n, c) => n + c.checked, 0);
  const short = scoped.reduce((n, c) => n + c.short, 0);
  const rate = missingRate(short, checked);
  const nameOf = (id: string) => (id === "none" ? t({ en: "Unknown agent", bn: "অজানা এজেন্ট" }) : agentNames[id] ?? t({ en: "Unknown agent", bn: "অজানা এজেন্ট" }));
  const agents = byAgent(scoped).map(b => ({ ...b, label: nameOf(b.key) }));
  const SHORT_KIND: Record<ClosureKind, Label> = { unreachable: { en: "Unreachable", bn: "যোগাযোগ হয়নি" }, conversation: { en: "Claimed talk", bn: "কথা দাবি" } };
  const kinds = byKind(scoped).map(b => ({ ...b, label: t(SHORT_KIND[b.key as ClosureKind]), full: t(kindLabel[b.key as ClosureKind]) }));
  const dates = byDate(scoped, from, to);
  const config: ChartConfig = {
    verified: { label: t({ en: "Enough verified calls", bn: "যথেষ্ট যাচাইকৃত কল" }), color: "var(--chart-3)" },
    short: { label: t({ en: "Missing verified calls", bn: "যাচাইকৃত কলের ঘাটতি" }), color: "var(--warning)" },
    rate: { label: t({ en: "Missing rate (%)", bn: "ঘাটতির হার (%)" }), color: "var(--chart-2)" },
  };
  const pct = (v: unknown) => (typeof v === "number" ? `${v}%` : "");
  const tooltip = <ChartTooltipContent formatter={(value, name) => (
    <div className="flex w-full items-center justify-between gap-3">
      <span className="text-muted-foreground">{config[String(name)]?.label ?? String(name)}</span>
      <span className="font-mono font-medium tabular-nums text-foreground">{name === "rate" ? pct(value) : String(value)}</span>
    </div>
  )} />;
  const short14 = (s: string) => (s.length > 14 ? `${s.slice(0, 13)}…` : s);
  const period = dates.granularity === "week" ? t({ en: "weekly, from the first day", bn: "সাপ্তাহিক, প্রথম দিন থেকে" }) : t({ en: "daily", bn: "দৈনিক" });

  if (!checked) return <p className="text-sm text-muted-foreground">{t({ en: "No checked closures for these filters, so there is nothing to chart.", bn: "এই ফিল্টারে যাচাই করা কোনো বন্ধ লিড নেই, তাই চার্ট নেই।" })}</p>;

  return (
    <section aria-label={t({ en: "Closure charts", bn: "বন্ধ লিডের চার্ট" })} className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-base font-semibold"><Bi en="Closures and missing verified-call rate" bn="বন্ধ লিড ও যাচাইকৃত কলের ঘাটতির হার" /></h3>
        <p className="text-sm tabular-nums text-muted-foreground">{t({ en: "Overall", bn: "মোট" })}: {short} / {checked} · <span className="font-semibold text-foreground">{pct(rate)}</span></p>
      </div>
      <p className="text-xs text-muted-foreground">{t({
        en: "Rate = closures missing verified calls ÷ closures checked. Charts follow the date, agent and closure-type filters (not the search box). They only count; they change no lead or rule.",
        bn: "হার = যাচাইকৃত কলের ঘাটতিসহ বন্ধ ÷ যাচাই করা বন্ধ। চার্ট তারিখ, এজেন্ট ও ধরন ফিল্টার মানে (খোঁজার ঘর নয়)। শুধু গণনা; কোনো লিড বা নিয়ম বদলায় না।",
      })}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <figure className="min-w-0 rounded-lg border border-border p-3">
          <figcaption className="mb-2 text-sm font-medium"><Bi en="By closing agent" bn="বন্ধকারী এজেন্ট অনুযায়ী" /></figcaption>
          <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(160, agents.length * 36 + 60) }} aria-label="Closures by agent chart">
            <BarChart data={agents} layout="vertical" margin={{ left: 0, right: 44 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" width={104} tickLine={false} axisLine={false} tickFormatter={short14} interval={0} />
              <ChartTooltip content={tooltip} />
              <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
              <Bar dataKey="verified" stackId="c" fill="var(--color-verified)" />
              <Bar dataKey="short" stackId="c" fill="var(--color-short)"><LabelList dataKey="rate" position="right" formatter={pct} className="fill-foreground text-xs" /></Bar>
            </BarChart>
          </ChartContainer>
        </figure>

        <figure className="min-w-0 rounded-lg border border-border p-3">
          <figcaption className="mb-2 text-sm font-medium"><Bi en="By closure type" bn="বন্ধের ধরন অনুযায়ী" /></figcaption>
          <ChartContainer config={config} className="aspect-auto h-44 w-full" aria-label="Closures by closure type chart">
            <BarChart data={kinds} layout="vertical" margin={{ left: 0, right: 44 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" width={104} tickLine={false} axisLine={false} tickFormatter={short14} interval={0} />
              <ChartTooltip content={tooltip} />
              <Bar dataKey="verified" stackId="c" fill="var(--color-verified)" />
              <Bar dataKey="short" stackId="c" fill="var(--color-short)"><LabelList dataKey="rate" position="right" formatter={pct} className="fill-foreground text-xs" /></Bar>
            </BarChart>
          </ChartContainer>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {kinds.map(k => <li key={k.key} className="flex justify-between gap-2"><span className="min-w-0 break-words">{k.full}</span><span className="shrink-0 tabular-nums">{k.short} / {k.checked} · {k.rate === null ? "—" : pct(k.rate)}</span></li>)}
          </ul>
        </figure>

        <figure className="min-w-0 rounded-lg border border-border p-3 lg:col-span-2">
          <figcaption className="mb-2 text-sm font-medium"><Bi en="By closing date" bn="বন্ধের তারিখ অনুযায়ী" /><span className="block text-xs font-normal text-muted-foreground">Asia/Dhaka · {period}</span></figcaption>
          <ChartContainer config={config} className="aspect-auto h-64 w-full" aria-label="Closures by date chart">
            <ComposedChart data={dates.points} margin={{ left: -16, right: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="key" tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} minTickGap={16} />
              <YAxis yAxisId="n" allowDecimals={false} tickLine={false} axisLine={false} width={40} />
              <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} width={46} tickFormatter={(v: number) => `${v}%`} />
              <ChartTooltip content={tooltip} />
              <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
              <Bar yAxisId="n" dataKey="verified" stackId="c" fill="var(--color-verified)" />
              <Bar yAxisId="n" dataKey="short" stackId="c" fill="var(--color-short)" />
              <Line yAxisId="r" dataKey="rate" type="monotone" stroke="var(--color-rate)" strokeWidth={2} dot={false} connectNulls={false} />
            </ComposedChart>
          </ChartContainer>
        </figure>
      </div>
    </section>
  );
}
