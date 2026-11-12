import { describe, expect, it } from "vitest";

import { PAYMENT_METHODS, paymentRequestDetail } from "@/lib/payment-methods";

describe("payment options", () => {
  it("offers exactly Pay manually, Payoneer, Skrill and Wise", () => {
    expect(PAYMENT_METHODS.map((m) => m.label)).toEqual(["Pay manually", "Pay with Payoneer", "Pay with Skrill", "Pay with Wise"]);
  });

  it("tells IT the chosen method and that only the System Architect confirms payment", () => {
    const detail = paymentRequestDetail("Executive HQ", "2026-11", "wise");
    expect(detail).toContain("Preferred method: Pay with Wise");
    expect(detail).toContain("confirmed only by the System Architect");
  });

  it("keeps the old alert wording when no method is chosen", () => {
    expect(paymentRequestDetail("Executive HQ", "2026-11")).not.toContain("Preferred method");
  });
});
