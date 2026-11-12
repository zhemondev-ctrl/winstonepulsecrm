import { useMutation } from "@tanstack/react-query";
import { Check, Globe, Headset, Send, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { requestPaymentHelp } from "@/lib/maintenance.functions";
import { PAYMENT_METHODS, paymentMethodLabel, type PaymentMethodId } from "@/lib/payment-methods";

const ICONS: Record<PaymentMethodId, typeof Wallet> = { manual: Headset, payoneer: Wallet, skrill: Send, wise: Globe };

/** Always-visible pay options. Choosing one tells the IT consultant; only the System Architect confirms payment. */
export function PaymentOptions() {
  const t = useT();
  const adminToken = useAdminToken();
  const [method, setMethod] = useState<PaymentMethodId>("manual");
  const send = useMutation({
    mutationFn: () => requestPaymentHelp({ data: { adminToken, method } }),
    onSuccess: () => toast.success(t({ bn: "IT কনসালট্যান্টকে জানানো হয়েছে।", en: "The IT consultant has been notified." })),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section aria-labelledby="pay-options-title" className="space-y-2">
      <p id="pay-options-title" className="text-sm font-semibold">{t({ bn: "কীভাবে পরিশোধ করবেন", en: "How to pay" })}</p>
      <div role="radiogroup" aria-labelledby="pay-options-title" className="grid grid-cols-2 gap-2">
        {PAYMENT_METHODS.map((m) => {
          const Icon = ICONS[m.id];
          const on = method === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => { setMethod(m.id); send.reset(); }}
              className={`relative flex min-h-16 flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                on ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent"
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold"><Icon className="size-4 shrink-0" aria-hidden />{m.label}</span>
              <span className="text-[11px] leading-snug text-muted-foreground">{t(m.hint)}</span>
              {on && <Check className="absolute right-2 top-2 size-4 text-primary" aria-hidden />}
            </button>
          );
        })}
      </div>
      <Button className="w-full" disabled={send.isPending || send.isSuccess} onClick={() => send.mutate()}>
        {send.isSuccess
          ? t({ bn: "IT কনসালট্যান্টকে পাঠানো হয়েছে", en: "Sent to IT consultant" })
          : t({ bn: `${paymentMethodLabel(method)} — IT কনসালট্যান্টের সাথে যোগাযোগ`, en: `${paymentMethodLabel(method)} — contact IT consultant` })}
      </Button>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {t({
          bn: "IT কনসালট্যান্ট পেমেন্টের বিবরণ পাঠাবেন। টাকা পাওয়ার পর শুধু System Architect পেমেন্ট নিশ্চিত করেন।",
          en: "The IT consultant will send the payment details. Only the System Architect confirms the payment after the amount is received.",
        })}
      </p>
    </section>
  );
}
