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

export type CustomerPipelineStatus = {
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
    case "pdf_ready":
    case "draft":
    case "submitted":
    case "submitted_api":
    case "submitted_manual":
    case "failed":
    case "errored":
    case "rejected":
      return {
        label: "Processing",
        detail: "Your book is being prepared for print.",
        tone: "neutral",
      };
    case "in_production":
    case "production_delayed":
      return {
        label: "Printing",
        detail: "Your book is currently being printed.",
        tone: "neutral",
      };
    case "shipped":
      return {
        label: "Shipped",
        detail: "Your book is on the way.",
        tone: "success",
      };
    case "delivered":
      return {
        label: "Delivered",
        detail: "Your book was delivered.",
        tone: "success",
      };
    default:
      return {
        label: "Processing",
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

type PipelineRunLike = {
  status: string | null | undefined;
  structuredFields?: unknown;
  errorMessage?: string | null;
};

function readPipelineStage(value: unknown): string | null {
  if (!value) return null;
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const stage = (parsed as { stage?: unknown }).stage;
  return typeof stage === "string" ? stage : null;
}

export function toCustomerPipelineStatus(run: PipelineRunLike | null | undefined): CustomerPipelineStatus {
  if (!run) {
    return {
      label: "Queued",
      detail: "Your order is queued for processing.",
      tone: "neutral",
    };
  }
  if (run.status === "failed") {
    return {
      label: "Processing issue",
      detail: run.errorMessage || "There was a temporary issue while processing your order.",
      tone: "warning",
    };
  }
  if (run.status === "running") {
    return {
      label: "Processing",
      detail: "We are generating your final book files.",
      tone: "neutral",
    };
  }

  const stage = readPipelineStage(run.structuredFields);
  if (stage === "complete") {
    return {
      label: "Processing complete",
      detail: "Your print files are ready.",
      tone: "success",
    };
  }
  if (stage === "waiting_for_assets") {
    return {
      label: "Processing queued",
      detail: "We are waiting for remaining story assets before finalization.",
      tone: "neutral",
    };
  }

  return {
    label: "Queued",
    detail: "Your order is queued for processing.",
    tone: "neutral",
  };
}
