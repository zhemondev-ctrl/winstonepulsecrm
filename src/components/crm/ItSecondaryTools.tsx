import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

/** Secondary panels mount only when explicitly opened. */
export function ItSecondaryTools({ children, title }: { children: ReactNode; title?: { en: string; bn: string } }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  return <section className="border-t border-border pt-4">
    <Button variant="ghost" className="h-auto w-full justify-between whitespace-normal py-3 text-left" onClick={() => setOpen(value => !value)} aria-expanded={open}>
      {t(title ?? { en: "More tools & history", bn: "আরও সরঞ্জাম ও ইতিহাস" })}
      {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
    </Button>
    {open && <div className="mt-4 min-w-0 space-y-6">{children}</div>}
  </section>;
}