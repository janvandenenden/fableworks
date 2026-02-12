"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { z } from "zod";
import { db, schema } from "@/db";
import {
  getCheckoutPriceConfig,
  getShippingCountries,
  getStripeClient,
  getAppBaseUrl,
} from "@/lib/stripe";

const checkoutPayloadSchema = z.object({
  storyId: z.string().uuid(),
  characterId: z.string().uuid().optional().nullable(),
});

function formValueToString(value: FormDataEntryValue | null): string | null {
  if (typeof value === "string") return value;
  return null;
}

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

async function ensureUserExists(userId: string): Promise<void> {
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (existing[0]) return;

  await db.insert(schema.users).values({
    id: userId,
    email: userId === "dev-user" ? "dev-user@local.fableworks" : `${userId}@local.fableworks`,
    role: "customer",
  });
}

export async function createCheckoutSessionAction(formData: FormData): Promise<void> {
  const rawStoryId = formValueToString(formData.get("storyId"));
  const rawCharacterId = formValueToString(formData.get("characterId"));
  const parsed = checkoutPayloadSchema.safeParse({
    storyId: rawStoryId,
    characterId: rawCharacterId,
  });

  if (!parsed.success) {
    throw new Error("Invalid checkout payload");
  }

  const resolvedUserId = await getCurrentUserIdOrFallback();
  const normalizedUserId =
    typeof resolvedUserId === "string" && resolvedUserId.trim().length > 0
      ? resolvedUserId.trim()
      : null;
  const stripe = getStripeClient();
  const appBaseUrl = getAppBaseUrl();
  const orderId = newId();

  const storyRows = await db
    .select({
      id: schema.stories.id,
      userId: schema.stories.userId,
      title: schema.stories.title,
    })
    .from(schema.stories)
    .where(eq(schema.stories.id, parsed.data.storyId))
    .limit(1);
  const story = storyRows[0];
  if (!story) {
    throw new Error("Story not found");
  }
  if (story.userId && story.userId !== normalizedUserId) {
    throw new Error("Story does not belong to current user");
  }

  const characterId = parsed.data.characterId?.trim() || null;
  let characterLabel = "";
  if (characterId) {
    const characterRows = await db
      .select({
        id: schema.characters.id,
        userId: schema.characters.userId,
        name: schema.characters.name,
      })
      .from(schema.characters)
      .where(eq(schema.characters.id, characterId))
      .limit(1);
    const character = characterRows[0];
    if (!character) {
      throw new Error("Character not found");
    }
    if (character.userId && character.userId !== normalizedUserId) {
      throw new Error("Character does not belong to current user");
    }
    characterLabel = character.name;
  }

  const priceConfig = getCheckoutPriceConfig();
  let amountCents: number;
  let currency: string;

  if (priceConfig.mode === "inline") {
    amountCents = priceConfig.amountCents;
    currency = priceConfig.currency;
  } else {
    const stripePrice = await stripe.prices.retrieve(priceConfig.priceId);
    if (typeof stripePrice.unit_amount !== "number" || !Number.isFinite(stripePrice.unit_amount)) {
      throw new Error("Stripe price is missing unit_amount");
    }
    amountCents = Math.round(stripePrice.unit_amount);
    currency = stripePrice.currency.toLowerCase();
  }

  if (normalizedUserId) {
    await ensureUserExists(normalizedUserId);
  }

  await db.insert(schema.orders).values({
    id: orderId,
    userId: normalizedUserId,
    storyId: parsed.data.storyId,
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

  const cancelUrl = new URL("/create/checkout", appBaseUrl);
  cancelUrl.searchParams.set("canceled", "1");
  cancelUrl.searchParams.set("storyId", parsed.data.storyId);
  if (characterId) {
    cancelUrl.searchParams.set("characterId", characterId);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${appBaseUrl}/create/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl.toString(),
    line_items: lineItems,
    shipping_address_collection: {
      allowed_countries: getShippingCountries() as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[],
    },
    metadata: {
      orderId,
      userId: normalizedUserId ?? "anonymous",
      storyId: parsed.data.storyId,
      characterId: characterId ?? "",
      characterLabel,
    },
  });

  await db
    .update(schema.orders)
    .set({ stripeCheckoutSessionId: session.id })
    .where(eq(schema.orders.id, orderId));

  if (!session.url) {
    throw new Error("Stripe did not return checkout URL");
  }

  redirect(session.url);
}
