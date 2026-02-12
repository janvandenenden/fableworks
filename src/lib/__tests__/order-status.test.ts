import { describe, expect, it } from "vitest";
import {
  toCustomerFulfillmentStatus,
  toCustomerPaymentStatus,
  toToneClasses,
} from "@/lib/order-status";

describe("order-status", () => {
  it("maps paid payment status to success", () => {
    const result = toCustomerPaymentStatus("paid");
    expect(result.label).toBe("Paid");
    expect(result.tone).toBe("success");
  });

  it("maps failed payment status to danger", () => {
    const result = toCustomerPaymentStatus("failed");
    expect(result.label).toBe("Payment failed");
    expect(result.tone).toBe("danger");
  });

  it("maps print status to customer-friendly fulfillment status", () => {
    const shipped = toCustomerFulfillmentStatus("shipped");
    expect(shipped.label).toBe("Shipped");
    expect(shipped.tone).toBe("success");

    const pending = toCustomerFulfillmentStatus("pending_generation");
    expect(pending.label).toBe("Processing");
    expect(pending.tone).toBe("neutral");
  });

  it("returns CSS classes for tone", () => {
    expect(toToneClasses("warning")).toContain("amber");
    expect(toToneClasses("danger")).toContain("destructive");
  });
});
