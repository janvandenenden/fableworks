import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db, schema } from "@/db";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/stripe";

function newId(): string {
  return crypto.randomUUID();
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      getStripeWebhookSecret()
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid webhook signature" },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadataOrderId = session.metadata?.orderId;

    const orderRows = metadataOrderId
      ? await db
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.id, metadataOrderId))
          .limit(1)
      : await db
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.stripeCheckoutSessionId, session.id))
          .limit(1);

    const order = orderRows[0];
    if (order) {
      await db
        .update(schema.orders)
        .set({
          paymentStatus: "paid",
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
        })
        .where(eq(schema.orders.id, order.id));

      const bookRows = await db
        .select()
        .from(schema.books)
        .where(eq(schema.books.orderId, order.id))
        .limit(1);

      if (!bookRows[0]) {
        await db.insert(schema.books).values({
          id: newId(),
          orderId: order.id,
          printStatus: "pending_generation",
        });
      }
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.id) {
      await db
        .update(schema.orders)
        .set({ paymentStatus: "expired" })
        .where(eq(schema.orders.stripeCheckoutSessionId, session.id));
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    await db
      .update(schema.orders)
      .set({ paymentStatus: "failed" })
      .where(eq(schema.orders.stripePaymentIntentId, intent.id));
  }

  return NextResponse.json({ received: true });
}
