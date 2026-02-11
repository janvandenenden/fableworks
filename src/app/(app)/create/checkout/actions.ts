"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCheckoutPriceConfig, getStripeClient, getAppBaseUrl } from "@/lib/stripe";

const checkoutPayloadSchema = z.object({
  storyId: z.string().uuid(),
  characterId: z.string().uuid().optional().nullable(),
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
    characterId: formData.get("characterId"),
  });

  if (!parsed.success) {
    throw new Error("Invalid checkout payload");
  }

  const userId = await getCurrentUserIdOrFallback();
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
  if (story.userId && story.userId !== userId) {
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
    if (character.userId && character.userId !== userId) {
      throw new Error("Character does not belong to current user");
    }
    characterLabel = character.name;
  }

  const priceConfig = getCheckoutPriceConfig();
  const amountCents =
    priceConfig.mode === "inline" ? priceConfig.amountCents : Number(process.env.BOOK_PRICE_CENTS ?? 2999);
  const currency = priceConfig.mode === "inline" ? priceConfig.currency : "usd";

  await db.insert(schema.orders).values({
    id: orderId,
    userId,
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
    success_url: `${appBaseUrl}/create/generating?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl.toString(),
    line_items: lineItems,
    metadata: {
      orderId,
      userId,
      storyId: parsed.data.storyId,
      characterId: characterId ?? "",
      characterLabel,
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
