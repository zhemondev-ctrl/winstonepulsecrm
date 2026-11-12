import { CalendarClock, MessagesSquare, Home, List, MessageCircle, PhoneCall, Send, LayoutGrid, FileText, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

const ITEMS = [
  { tab: "today", label: { bn: "আজ", en: "Today" }, Icon: Home, tone: "text-chart-2 bg-chart-2/10" },
  { tab: "pipeline", label: { bn: "কাজের ধাপ", en: "Work stages" }, Icon: LayoutGrid, tone: "text-primary bg-primary/10" },
  { tab: "leads", label: { bn: "লিড", en: "Contacts" }, Icon: List, tone: "text-chart-2 bg-chart-2/10" },
  { tab: "tasks", label: { bn: "কাজ", en: "Tasks" }, Icon: CalendarClock, tone: "text-chart-4 bg-chart-4/10" },
  { tab: "activities", label: { bn: "কাজের নথি", en: "Work log" }, Icon: PhoneCall, tone: "text-success bg-success/10" },
  { tab: "outlook", label: { bn: "আজকের অবস্থা", en: "Today's status" }, Icon: FileText, tone: "text-chart-2 bg-chart-2/10" },
  { tab: "queue", label: { bn: "কার্ড ভিউ", en: "Queue" }, Icon: LayoutGrid, tone: "text-primary bg-primary/10" },
  { tab: "calls", label: { bn: "কল", en: "Calls" }, Icon: PhoneCall, tone: "text-success bg-success/10" },
  { tab: "whatsapp", label: { bn: "হোয়াটসঅ্যাপ", en: "WhatsApp" }, Icon: MessageCircle, tone: "text-success bg-success/10" },
  { tab: "messenger", label: { bn: "মেসেঞ্জার", en: "Messenger" }, Icon: Send, tone: "text-primary bg-primary/10" },
  { tab: "calendar", label: { bn: "ফলো-আপ", en: "Follow-ups" }, Icon: CalendarClock, tone: "text-chart-4 bg-chart-4/10" },
  { tab: "reports", label: { bn: "রিপোর্ট", en: "Reports" }, Icon: FileText, tone: "text-chart-2 bg-chart-2/10" },
  { tab: "social", label: { bn: "সোশ্যাল", en: "Social" }, Icon: MessagesSquare, tone: "text-primary bg-primary/10" },
  { tab: "support", label: { bn: "সাপোর্ট", en: "Support" }, Icon: LifeBuoy, tone: "text-destructive bg-destructive/10" },
] as const;

/** All sections always visible in a compact grid; no sideways navigation, never hidden. */
export function DeskTabBar({ tab, onChange }: { tab: string; onChange: (t: string) => void }) {
  const t = useT();
  return <nav aria-label={t({ bn: "ডেস্ক সেকশন", en: "Desk sections" })}
    className="grid grid-cols-2 gap-1 border-y border-border bg-background p-1.5 sm:grid-cols-5 lg:grid-cols-7">
    <Button asChild variant="ghost" className="h-auto min-h-9 min-w-0 justify-start gap-1.5 rounded-md border border-transparent px-1.5 py-1 text-left text-xs">
      <Link to="/" title={t({ bn: "হোম", en: "Home" })}>
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-chart-2/10 text-chart-2"><Home className="size-3.5" /></span>
        <span className="min-w-0 break-words leading-tight">{t({ bn: "হোম", en: "Home" })}</span>
      </Link>
    </Button>
    {ITEMS.map(({ tab: value, label, Icon, tone }) => <Button key={value} variant="ghost" aria-current={tab === value ? "page" : undefined}
      onClick={() => onChange(value)}
      className={cn("h-auto min-h-9 min-w-0 justify-start gap-1.5 rounded-md border px-1.5 py-1 text-left text-xs", tab === value ? "border-ring bg-accent font-bold" : "border-transparent")}>
      <span className={cn("grid size-6 shrink-0 place-items-center rounded-md", tone)}><Icon className="size-3.5" /></span>
      <span className="min-w-0 break-words leading-tight">{t(label)}</span>
    </Button>)}
  </nav>;
}
