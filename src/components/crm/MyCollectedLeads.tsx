import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, FileText, Loader2, RefreshCw, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadDossier } from "./LeadDossier";
import { NewLeadDialog } from "./NewLeadDialog";
import { LeadImportDialog } from "./LeadImportDialog";
import { buildTimeline, useSnapshot } from "@/lib/crm-data";
import { readMyLeadCollection } from "@/lib/lead-collection.functions";
import { useMyAccount } from "@/lib/session";
import { useLang, useT } from "@/lib/i18n";

export function MyCollectedLeads() {
  const t = useT();
  const lang = useLang();
  const { account } = useMyAccount();
  const read = useServerFn(readMyLeadCollection);
  const [mode, setMode] = useState<"drafts" | "receipts" | "assigned">("receipts");
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const snapshot = useSnapshot();
  const invalid = Boolean(from && to && from > to);
  const data = useQuery({ queryKey: ["my-lead-collection", account?.profile?.id, mode, search, from, to, offset], queryFn: () => read({ data: { mode, query: search, from: from || null, to: to || null, offset } }), enabled: Boolean(account?.signedIn && account.profile && !invalid), retry: false, staleTime: 30000 });
  const at = (value: string) => new Date(value).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });
  const openLead = snapshot.leads.find(lead => lead.id === openLeadId && (lead.assigned_to ?? lead.assigned_agent_id) === account?.profile?.id && (!lead.assigned_to || !lead.assigned_agent_id || lead.assigned_to === lead.assigned_agent_id)) ?? null;
  if (!account?.signedIn || !account.profile) return null;
  return <section id="my-collected-leads" className="min-w-0 space-y-4 border-y border-border py-5" aria-label={t({ bn: "আমার সংগ্রহ করা লিড", en: "My collected leads" })}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h2 className="text-lg font-semibold">{t({ bn: "আমার সংগ্রহ করা লিড", en: "My collected leads" })}</h2><p className="mt-1 text-sm text-muted-foreground">{data.data?.ready ? `${data.data.used} / ${data.data.limit} · ${data.data.today}` : t({ bn: "সংরক্ষণ প্রস্তুতির অপেক্ষায়", en: "Awaiting saving setup" })}</p></div>
      <div className="flex flex-wrap gap-2"><NewLeadDialog onViewReceipt={id => { setMode("receipts"); setQuery(`LC-${id.slice(0,8).toUpperCase()}`); setFrom(""); setTo(""); setOffset(0); }} /><LeadImportDialog /><Button variant="ghost" size="icon" title={t({ bn: "আবার দেখুন", en: "Refresh" })} aria-label={t({ bn: "সংগ্রহ করা লিড রিফ্রেশ", en: "Refresh collected leads" })} onClick={() => void data.refetch()}><RefreshCw className="size-4" /></Button></div>
    </div>
    <Tabs value={mode} onValueChange={value => { if (value === "drafts" || value === "receipts" || value === "assigned") { setMode(value); setOffset(0); } }}><TabsList className="h-auto max-w-full flex-wrap"><TabsTrigger value="drafts">{t({ bn: "খসড়া", en: "Drafts" })}</TabsTrigger><TabsTrigger value="receipts">{t({ bn: "জমার রসিদ", en: "Submissions" })}</TabsTrigger><TabsTrigger value="assigned">{t({ bn: "আমাকে বরাদ্দ", en: "Assigned to me" })}</TabsTrigger></TabsList></Tabs>
    {mode !== "drafts" && <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_160px]">
      <div className="space-y-1.5"><Label htmlFor="collection-search">{t({ bn: "রসিদ / নিজের লিড খুঁজুন", en: "Search receipt / owned lead" })}</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input id="collection-search" className="pl-9" value={query} onChange={e => { setQuery(e.target.value); setOffset(0); }} maxLength={120} /></div></div>
      <div className="space-y-1.5"><Label htmlFor="collection-from">{t({ bn: "শুরু", en: "From" })}</Label><Input id="collection-from" type="date" value={from} onChange={e => { setFrom(e.target.value); setOffset(0); }} /></div>
      <div className="space-y-1.5"><Label htmlFor="collection-to">{t({ bn: "শেষ", en: "To" })}</Label><Input id="collection-to" type="date" value={to} onChange={e => { setTo(e.target.value); setOffset(0); }} /></div>
    </div>}
    {invalid && <p role="alert" className="text-sm text-destructive">{t({ bn: "শুরুর তারিখ শেষের পরে হতে পারে না", en: "From must not follow To" })}</p>}
    {data.isPending && !invalid && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t({ bn: "লোড হচ্ছে", en: "Loading" })}</p>}
    {data.isError && <p role="alert" className="text-sm text-destructive">{t({ bn: "সংরক্ষিত তথ্য পাওয়া যায়নি। আবার দেখুন।", en: "Saved entries unavailable. Please refresh." })}</p>}
    {data.data?.ready === false && <div role="status" className="flex gap-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm"><FileText className="mt-0.5 size-4 shrink-0 text-warning" /><p>{t({ bn: "নিরাপদ খসড়া ও জমার রসিদ এখনো চালু হয়নি। কোনো নতুন লিড জমা হচ্ছে না।", en: "Secure drafts and submission receipts are not activated yet. New leads are not being submitted." })}</p></div>}
    {data.data?.ready && !invalid && <>
      {mode === "drafts" ? <div className="grid gap-3 sm:grid-cols-2">{data.data.drafts.map(draft => <article key={draft.id} className="space-y-2 rounded-md border border-border p-3"><h3 className="break-words font-medium">{draft.fields.name || t({ bn: "নামহীন খসড়া", en: "Untitled draft" })}</h3><p className="text-xs text-muted-foreground">{at(draft.updatedAt)}</p><NewLeadDialog draft={draft} /></article>)}{!data.data.drafts.length && <p className="text-sm text-muted-foreground">{t({ bn: "কোনো খসড়া নেই", en: "No drafts" })}</p>}</div> : <>
        <div className="grid gap-3 md:hidden">{data.data.receipts.map(receipt => <article key={receipt.id} className="space-y-2 rounded-md border border-border p-3"><h3 className="break-words font-medium">{receipt.lead?.name ?? receipt.reference}</h3><p className="text-xs text-muted-foreground">{receipt.reference} · {at(receipt.acceptedAt)}</p><p className="text-sm">{receipt.state === "awaiting_leadhub" ? t({ bn: "LeadHub-এর অপেক্ষায়", en: "Awaiting LeadHub" }) : receipt.state === "assigned_to_me" ? t({ bn: "আমাকে বরাদ্দ", en: "Assigned to me" }) : t({ bn: "গ্রাহকের তথ্য দেখা যাবে না", en: "Customer details unavailable" })}</p>{receipt.lead && <><p className="text-sm">{receipt.lead.phone} · {receipt.lead.status}</p><Button variant="outline" size="sm" onClick={() => setOpenLeadId(receipt.lead?.id ?? null)}>{t({ bn: "লিড দেখুন", en: "View lead" })}</Button></>}</article>)}</div>
        <div className="table-scroll hidden md:block"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="py-2 pr-3">{t({ bn: "রসিদ", en: "Receipt" })}</th><th className="py-2 pr-3">{t({ bn: "তারিখ", en: "Submitted" })}</th><th className="py-2 pr-3">{t({ bn: "অবস্থা", en: "Status" })}</th><th className="py-2">{t({ bn: "নিজের লিড", en: "Owned lead" })}</th></tr></thead><tbody>{data.data.receipts.map(receipt => <tr key={receipt.id} className="border-b border-border"><td className="py-3 pr-3">{receipt.reference}</td><td className="py-3 pr-3">{at(receipt.acceptedAt)}</td><td className="py-3 pr-3">{receipt.state === "awaiting_leadhub" ? t({ bn: "LeadHub-এর অপেক্ষায়", en: "Awaiting LeadHub" }) : receipt.state === "assigned_to_me" ? t({ bn: "আমাকে বরাদ্দ", en: "Assigned to me" }) : t({ bn: "তথ্য দেখা যাবে না", en: "Unavailable" })}</td><td className="py-3">{receipt.lead ? <Button variant="link" className="h-auto whitespace-normal p-0 text-left" onClick={() => setOpenLeadId(receipt.lead?.id ?? null)}>{receipt.lead.name} · {receipt.lead.phone}</Button> : "—"}</td></tr>)}</tbody></table></div>
        {!data.data.receipts.length && <p className="text-sm text-muted-foreground">{t({ bn: "এই সীমায় কোনো জমার রসিদ নেই", en: "No submissions in this range" })}</p>}
        <div className="flex items-center justify-end gap-2"><Button size="icon" variant="outline" disabled={offset === 0} aria-label={t({ bn: "আগের জমা", en: "Previous submissions" })} onClick={() => setOffset(Math.max(0,offset-25))}><ChevronLeft className="size-4" /></Button><span className="text-xs text-muted-foreground">{offset/25+1}</span><Button size="icon" variant="outline" disabled={!data.data.hasMore} aria-label={t({ bn: "পরের জমা", en: "Next submissions" })} onClick={() => setOffset(offset+25)}><ChevronRight className="size-4" /></Button></div>
      </>}
    </>}
    <LeadDossier lead={openLead} open={Boolean(openLeadId && openLead)} onOpenChange={open => { if (!open) setOpenLeadId(null); }} agents={snapshot.profiles} timeline={openLead ? buildTimeline(snapshot.calls,snapshot.messages,openLead.id,snapshot.events) : []} />
  </section>;
}