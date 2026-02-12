import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("Missing STRIPE_SECRET_KEY");
    }
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  }
  return secret;
}

export function getAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost:3000";
}

export function getCheckoutPriceConfig():
  | { mode: "price_id"; priceId: string }
  | { mode: "inline"; amountCents: number; currency: string; productName: string } {
  const priceId = process.env.STRIPE_PRICE_ID_TEST?.trim();
  if (priceId) {
    return { mode: "price_id", priceId };
  }

  const amountCents = Number(process.env.BOOK_PRICE_CENTS ?? 2999);
  const currency = (process.env.BOOK_PRICE_CURRENCY ?? "usd").toLowerCase();
  const productName = process.env.BOOK_PRODUCT_NAME?.trim() || "Personalized Book";

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("BOOK_PRICE_CENTS must be a positive integer");
  }

  return {
    mode: "inline",
    amountCents: Math.round(amountCents),
    currency,
    productName,
  };
}

export function getShippingCountries(): string[] {
  const raw = process.env.STRIPE_SHIPPING_COUNTRIES?.trim();
  if (!raw) {
    return ["US", "BE", "NL", "FR", "DE", "GB", "CA", "AU"];
  }
  const codes = raw
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item) => /^[A-Z]{2}$/.test(item));
  return codes.length > 0 ? codes : ["US"];
}
