import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CheckCircle2, ShieldAlert, Layers, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

const pages = [
  { name: "HQ", path: "/hq", implementation: "মিটিং অনুমোদন সরানো; তারিখভিত্তিক স্কোর তৈরি", business: "HQ সিদ্ধান্ত ও বুকিং অনুমোদন বহাল", enImplementation: "Meeting approvals removed; dated scores implemented", enBusiness: "HQ decisions and booking approvals retained" },
  { name: "IT", path: "/system", implementation: "মিটিং অনুমোদন সরানো; IT সরঞ্জাম অক্ষত", business: "পূর্ণ IT PIN ও অ্যাকাউন্টের সীমা বহাল", enImplementation: "Meeting approvals removed; IT tools retained", enBusiness: "Full IT PIN and account boundaries retained" },
  { name: "Nexus", path: "/leadhub", implementation: "বর্তমান LeadHub বাস্তবায়ন", business: "লিড বরাদ্দ শুধু Nexus দিয়ে", enImplementation: "Existing LeadHub implementation", enBusiness: "Lead assignment exclusively through Nexus" },
  { name: "Agents", path: "/desk", implementation: "বর্তমান ডেস্ক ও কল-প্রমাণের পথ", business: "নিজের লিড, কোটা ও ব্রিফিংয়ের নিয়ম বহাল", enImplementation: "Existing desk and phone-proof flow", enBusiness: "Own-lead, quota and briefing rules retained" },
  { name: "System", path: "/system", implementation: "IT-এর একই পেজ; আলাদা প্রকাশ নয়", business: "বিল ও Architect যাচাইয়ের নিয়ম বহাল", enImplementation: "Same page as IT; not a separate deployment", enBusiness: "Billing and Architect verification rules retained" },
] as const;

export function ReleaseStatusDashboard() {
  const t = useT();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("all");
  const visible = pages.filter(p => (selected === "all" || p.name === selected) && `${p.name} ${p.path}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
    <header className="space-y-2 border-b border-border pb-5">
      <div className="flex items-center gap-3"><Layers className="size-6 text-gold" /><h1 className="text-2xl font-semibold">{t({ bn: "বাস্তবায়ন ও প্রকাশের অবস্থা", en: "Implementation & release status" })}</h1></div>
      <p className="text-sm text-muted-foreground">WINSTONE PULSE · {t({ bn: "সংরক্ষিত যাচাই: ১৪ নভেম্বর ২০২৬, ২০:৫৭ ঢাকা · সরাসরি পর্যবেক্ষণ নয়", en: "Recorded verification: 14 Nov 2026, 20:57 Dhaka · Not live monitoring" })}</p>
    </header>
    <section className="grid gap-4 border-b border-border pb-5 sm:grid-cols-3">
      <div><p className="text-sm text-muted-foreground">{t({ bn: "ডেভেলপমেন্ট", en: "Development" })}</p><p className="mt-1 font-semibold">{t({ bn: "মালিকের অনুমোদন লাগে না", en: "No owner approval required" })}</p></div>
      <div><p className="text-sm text-muted-foreground">{t({ bn: "প্রকাশের চিহ্ন", en: "Release markers" })}</p><p className="mt-1 flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4 text-success" />1.7.0 · $35.29 · 50</p></div>
      <div><p className="text-sm text-muted-foreground">{t({ bn: "লাইভ পেজ", en: "Published pages" })}</p><p className="mt-1 font-semibold">{t({ bn: "৫টি নাম · ৪টি ঠিকানা · HTTP 200", en: "5 labels · 4 addresses · HTTP 200" })}</p></div>
    </section>
    <section className="border-l-4 border-destructive bg-destructive/5 p-4" aria-label="Security review">
      <h2 className="flex items-center gap-2 font-semibold text-destructive"><ShieldAlert className="size-5" />{t({ bn: "নিরাপত্তা: বিস্তৃত ব্যবহারের ছাড়পত্র নয়", en: "Security: not cleared for wide rollout" })}</h2>
      <p className="mt-2 text-sm">{t({ bn: "গভীর পরীক্ষা শেষ: ১৪ নভেম্বর, ২০:৫৭ ঢাকা। ২টি গুরুতর সমস্যা পর্যালোচনা বাকি; ফল সর্বশেষ কোডের জন্য হালনাগাদ চিহ্নিত নয়।", en: "Deep scan completed: 14 Nov, 20:57 Dhaka. Two critical findings await review; results are not marked current for the latest code." })}</p>
      <p className="mt-2 text-sm text-muted-foreground">{t({ bn: "সাধারণ পরীক্ষায় সমস্যা পাওয়া যায়নি। আলাদা নির্ভরতা পরীক্ষায় ১টি উচ্চ ও ৬টি মাঝারি ঝুঁকির সতর্কতা ছিল। প্রকাশিত হওয়া নিরাপদ হওয়ার প্রমাণ নয়।", en: "Basic checks found no issues. Separate dependency checks reported one high and six moderate advisories. Publication does not establish safety." })}</p>
    </section>
    <div className="flex flex-col gap-3 sm:flex-row">
      <label className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><input aria-label="Search workspace" value={search} onChange={e => setSearch(e.target.value)} placeholder={t({ bn: "পেজ খুঁজুন", en: "Search pages" })} className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" /></label>
      <select aria-label="Workspace" value={selected} onChange={e => setSelected(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="all">{t({ bn: "সব পেজ", en: "All pages" })}</option>{pages.map(p => <option key={p.name}>{p.name}</option>)}</select>
    </div>
    <div className="hidden md:block table-scroll"><table className="w-full text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr>{[t({ bn: "পেজ", en: "Page" }),t({ bn: "বাস্তবায়ন", en: "Implementation" }),t({ bn: "ব্যবসায়িক অনুমোদন", en: "Business authorization" }),t({ bn: "নিরাপত্তা", en: "Security" }),t({ bn: "প্রকাশ", en: "Publication" })].map(h => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}</tr></thead><tbody>{visible.map(p => <tr key={p.name} className="border-b border-border"><td className="px-3 py-4"><Button asChild variant="ghost"><Link to={p.path}>{p.name}<ArrowUpRight className="size-4" /></Link></Button><p className="text-xs text-muted-foreground">{p.path}</p></td><td className="max-w-64 px-3 py-4">{t({ bn:p.implementation,en:p.enImplementation })}</td><td className="max-w-64 px-3 py-4">{t({ bn:p.business,en:p.enBusiness })}</td><td className="px-3 py-4 text-destructive">{t({ bn:"পর্যালোচনা বাকি",en:"Review pending" })}</td><td className="px-3 py-4"><p className="font-medium">HTTP 200</p><p className="text-xs text-muted-foreground">{t({ bn:"সাইন-ইন/PIN পর্যন্ত যাচাই",en:"Sign-in/PIN gate verified" })}</p></td></tr>)}</tbody></table></div>
    <div className="grid gap-3 md:hidden">{visible.map(p => <article key={p.name} className="rounded-md border border-border bg-card p-4"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{p.name}</h2><Button asChild variant="ghost" size="icon"><Link to={p.path} aria-label={`Open ${p.name}`}><ArrowUpRight /></Link></Button></div><p className="mb-3 text-xs text-muted-foreground">{p.path}</p><dl className="space-y-3 text-sm">{[[t({bn:"বাস্তবায়ন",en:"Implementation"}),t({bn:p.implementation,en:p.enImplementation})],[t({bn:"ব্যবসায়িক অনুমোদন",en:"Business authorization"}),t({bn:p.business,en:p.enBusiness})],[t({bn:"নিরাপত্তা",en:"Security"}),t({bn:"পর্যালোচনা বাকি",en:"Review pending"})],[t({bn:"প্রকাশ",en:"Publication"}),t({bn:"HTTP 200 · সাইন-ইন/PIN পর্যন্ত যাচাই",en:"HTTP 200 · Sign-in/PIN gate verified"})]].map(([label,value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1">{value}</dd></div>)}</dl></article>)}</div>
    {visible.length === 0 && <p role="status" className="py-8 text-center text-muted-foreground">{t({bn:"কোনো পেজ পাওয়া যায়নি",en:"No matching pages"})}</p>}
    <section className="border-t border-border pt-4"><h2 className="font-semibold">{t({bn:"বাকি যাচাই",en:"Outstanding verification"})}</h2><ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground"><li>{t({bn:"লাইভ HQ/IT-তে সাইন-ইনের পর মিটিং অনুমোদন অপসারণ এবং বিল/ভিজিট সতর্কতা রাখা। প্রিভিউতে যাচাই হয়েছে।",en:"Signed-in live HQ/IT confirmation of removed meeting approvals and retained billing/visit alerts; verified in preview only."})}</li><li>{t({bn:"Saiful-এর বাস্তব ফোনে কল-প্রমাণ থেকে V বৃদ্ধি এখনো অযাচাইকৃত।",en:"Saiful’s real-phone proof-to-V increase remains unverified."})}</li><li>{t({bn:"এই নতুন ড্যাশবোর্ড এখন প্রিভিউতে; এর প্রকাশের যাচাই বাকি।",en:"This new dashboard is in preview; its publication is not verified."})}</li></ul></section>
  </main>;
}