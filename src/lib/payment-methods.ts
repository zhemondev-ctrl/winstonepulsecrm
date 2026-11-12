/**
 * Ways the monthly architecture charge can be paid. These are display + request options only:
 * nothing here moves money or marks a bill paid. The System Architect confirms every payment
 * after checking the amount actually received.
 */
export const PAYMENT_METHOD_IDS = ["manual", "payoneer", "skrill", "wise"] as const;
export type PaymentMethodId = (typeof PAYMENT_METHOD_IDS)[number];

export type PaymentMethod = {
  id: PaymentMethodId;
  label: string;
  hint: { bn: string; en: string };
};

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  {
    id: "manual",
    label: "Pay manually",
    hint: { bn: "IT কনসালট্যান্টের সাথে যোগাযোগ করে সরাসরি পরিশোধ", en: "Contact the IT consultant and pay directly" },
  },
  { id: "payoneer", label: "Pay with Payoneer", hint: { bn: "Payoneer-এ পাঠান", en: "Send through Payoneer" } },
  { id: "skrill", label: "Pay with Skrill", hint: { bn: "Skrill-এ পাঠান", en: "Send through Skrill" } },
  { id: "wise", label: "Pay with Wise", hint: { bn: "Wise-এ পাঠান", en: "Send through Wise" } },
];

export function paymentMethodLabel(id: PaymentMethodId): string {
  return PAYMENT_METHODS.find((m) => m.id === id)?.label ?? "Pay manually";
}

/** Line added to the IT alert so the consultant knows which channel to send details for. */
export function paymentRequestDetail(requester: string, period: string, method?: PaymentMethodId | null): string {
  const base = `${requester} asked IT Console to settle the ${period} architecture charge ($35.29 USD incl. 15% VAT).`;
  return method ? `${base} Preferred method: ${paymentMethodLabel(method)}. Payment is confirmed only by the System Architect.` : base;
}
