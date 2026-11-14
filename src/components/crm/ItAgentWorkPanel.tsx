import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSnapshot, buildAgentStats } from "@/lib/crm-data";
import { useT } from "@/lib/i18n";

export function ItAgentWorkPanel() {
  const { profiles, leads, calls, messages } = useSnapshot();
  const t = useT();
  const [search, setSearch] = useState("");
  const rows = useMemo(() => buildAgentStats(profiles, leads, calls, messages)
    .filter(row => `${row.profile.name} ${row.profile.employee_id ?? ""}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.pendingWork - a.pendingWork), [profiles, leads, calls, messages, search]);
  return <section className="space-y-4 border-b border-border pb-5" aria-label="Agent pending leads">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-base font-semibold">{t({ bn: "এজেন্টের বাকি লিড", en: "Agent pending leads" })}</h2>
      <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" aria-hidden="true" /><Input className="pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder={t({ bn: "এজেন্ট খুঁজুন", en: "Search agents" })} aria-label="Search agents" /></div>
    </header>
    <ul className="grid gap-3 md:hidden">{rows.map(row => <li key={row.profile.id} className="rounded-md border border-border p-3"><p className="break-words font-medium">{row.profile.name}</p><p className="text-xs text-muted-foreground">{row.profile.employee_id ?? "—"}</p><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt>{t({ bn: "বাকি কাজ", en: "Pending work" })}</dt><dd className="font-semibold tabular-nums">{row.pendingWork}</dd></div><div><dt>{t({ bn: "মোট লিড", en: "Assigned leads" })}</dt><dd className="font-semibold tabular-nums">{row.assigned}</dd></div></dl></li>)}</ul>
    <div className="table-scroll hidden md:block"><table className="w-full text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="py-3 font-medium">{t({ bn: "এজেন্ট", en: "Agent" })}</th><th className="font-medium">Agent ID</th><th className="text-right font-medium">{t({ bn: "মোট লিড", en: "Assigned leads" })}</th><th className="text-right font-medium">{t({ bn: "বাকি কাজ", en: "Pending work" })}</th></tr></thead><tbody>{rows.map(row => <tr key={row.profile.id} className="border-b border-border"><td className="py-3 font-medium">{row.profile.name}</td><td className="text-muted-foreground">{row.profile.employee_id ?? "—"}</td><td className="text-right tabular-nums">{row.assigned}</td><td className="text-right font-semibold tabular-nums">{row.pendingWork}</td></tr>)}</tbody></table></div>
    {rows.length === 0 && <p className="text-sm text-muted-foreground">{t({ bn: "কোনো এজেন্ট পাওয়া যায়নি।", en: "No agents found." })}</p>}
  </section>;
}