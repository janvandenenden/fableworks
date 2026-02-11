"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCheckoutPriceConfig, getStripeClient, getAppBaseUrl } from "@/lib/stripe";

const checkoutPayloadSchema = z.object({
  storyId: z.string().min(1),
  characterLabel: z.string().optional().nullable(),
});

async function getCurrentUserIdOrFallback(): Promise<string> {
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const authResult = await auth();
    if (authResult?.userId) return authResult.userId;
  } catch {
    // Clerk not configured in local dev.
  }
  return "dev-user";
}

function newId(): string {
  return crypto.randomUUID();
}

export async function createCheckoutSessionAction(formData: FormData): Promise<void> {
  const parsed = checkoutPayloadSchema.safeParse({
    storyId: formData.get("storyId"),
    characterLabel: formData.get("characterLabel"),
  });

  if (!parsed.success) {
    throw new Error("Invalid checkout payload");
  }

  const userId = await getCurrentUserIdOrFallback();
  const stripe = getStripeClient();
  const appBaseUrl = getAppBaseUrl();
  const orderId = newId();

  const priceConfig = getCheckoutPriceConfig();
  const amountCents =
    priceConfig.mode === "inline" ? priceConfig.amountCents : Number(process.env.BOOK_PRICE_CENTS ?? 2999);
  const currency = priceConfig.mode === "inline" ? priceConfig.currency : "usd";

  await db.insert(schema.orders).values({
    id: orderId,
    userId,
    paymentStatus: "pending",
    amountCents,
    currency,
  });

  const lineItems: Parameters<typeof stripe.checkout.sessions.create>[0]["line_items"] =
    priceConfig.mode === "price_id"
      ? [{ price: priceConfig.priceId, quantity: 1 }]
      : [
          {
            quantity: 1,
            price_data: {
              currency: priceConfig.currency,
              unit_amount: priceConfig.amountCents,
              product_data: {
                name: priceConfig.productName,
              },
            },
          },
        ];

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${appBaseUrl}/create/generating?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appBaseUrl}/create/checkout?canceled=1`,
    line_items: lineItems,
    metadata: {
      orderId,
      userId,
      storyId: parsed.data.storyId,
      characterLabel: parsed.data.characterLabel?.trim() || "",
    },
  });

  await db
    .update(schema.orders)
    .set({ stripeCheckoutSessionId: session.id })
    .where((fields, { eq }) => eq(fields.id, orderId));

  if (!session.url) {
    throw new Error("Stripe did not return checkout URL");
  }

  redirect(session.url);
}
