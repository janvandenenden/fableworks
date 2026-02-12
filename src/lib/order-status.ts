type CustomerStatusTone = "neutral" | "success" | "warning" | "danger";

export type CustomerPaymentStatus = {
  label: string;
  detail: string;
  tone: CustomerStatusTone;
};

export type CustomerFulfillmentStatus = {
  label: string;
  detail: string;
  tone: CustomerStatusTone;
};

export function toCustomerPaymentStatus(status: string | null | undefined): CustomerPaymentStatus {
  switch (status) {
    case "paid":
      return {
        label: "Paid",
        detail: "Your payment was received successfully.",
        tone: "success",
      };
    case "failed":
      return {
        label: "Payment failed",
        detail: "Payment failed. Try checkout again with a different method.",
        tone: "danger",
      };
    case "expired":
      return {
        label: "Checkout expired",
        detail: "Your checkout session expired before payment completed.",
        tone: "warning",
      };
    default:
      return {
        label: "Pending payment",
        detail: "Waiting for payment confirmation from Stripe.",
        tone: "warning",
      };
  }
}

export function toCustomerFulfillmentStatus(
  printStatus: string | null | undefined
): CustomerFulfillmentStatus {
  switch (printStatus) {
    case "pending_generation":
      return {
        label: "Preparing artwork",
        detail: "We are preparing your final pages and print files.",
        tone: "neutral",
      };
    case "pdf_ready":
      return {
        label: "Files ready",
        detail: "Your print-ready files are complete and queued for print.",
        tone: "neutral",
      };
    case "submitted":
      return {
        label: "Submitted to print",
        detail: "Your book has been submitted to the print partner.",
        tone: "neutral",
      };
    case "in_production":
    case "production_delayed":
      return {
        label: "In production",
        detail: "Your book is currently being printed.",
        tone: "neutral",
      };
    case "shipped":
      return {
        label: "Shipped",
        detail: "Your book is on the way.",
        tone: "success",
      };
    case "rejected":
    case "errored":
      return {
        label: "Needs attention",
        detail: "There is an issue with fulfillment. We are reviewing it.",
        tone: "danger",
      };
    case "delivered":
      return {
        label: "Delivered",
        detail: "Your book was delivered.",
        tone: "success",
      };
    default:
      return {
        label: "Queued",
        detail: "Your order is in queue for fulfillment.",
        tone: "neutral",
      };
  }
}

export function toToneClasses(tone: CustomerStatusTone): string {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "danger":
      return "border-destructive/40 bg-destructive/5 text-destructive";
    default:
      return "border-border bg-muted/30 text-foreground";
  }
}
