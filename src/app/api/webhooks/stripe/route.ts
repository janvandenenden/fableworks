import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db, schema } from "@/db";
import { inngest } from "@/inngest/client";
import { grantPaidRerollCreditsForOrder } from "@/lib/credits";
import {
  getAutoGenerateAfterPayment,
  getStripeClient,
  getStripeWebhookSecret,
} from "@/lib/stripe";

function newId(): string {
  return crypto.randomUUID();
}

function readStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function extractShippingPayload(session: Stripe.Checkout.Session): {
  shippingName: string | null;
  shippingEmail: string | null;
  shippingPhone: string | null;
  shippingAddressJson: string | null;
} {
  const customerDetails = session.customer_details;
  const shippingDetails = session.shipping_details;
  const address = shippingDetails?.address ?? customerDetails?.address ?? null;

  return {
    shippingName: readStringOrNull(shippingDetails?.name) ?? readStringOrNull(customerDetails?.name),
    shippingEmail: readStringOrNull(customerDetails?.email) ?? readStringOrNull(session.customer_email),
    shippingPhone: readStringOrNull(customerDetails?.phone),
    shippingAddressJson: address ? JSON.stringify(address) : null,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /unique constraint|primary key/i.test(error.message);
}

async function reserveWebhookEvent(event: Stripe.Event): Promise<boolean> {
  try {
    await db.insert(schema.promptArtifacts).values({
      id: event.id,
      entityType: "stripe_webhook_event",
      entityId: event.id,
      rawPrompt: event.type,
      status: "running",
      parameters: JSON.stringify({
        livemode: event.livemode,
        created: event.created,
      }),
    });
    return true;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return false;
    }
    throw error;
  }
}

async function markWebhookEventProcessed(
  eventId: string,
  status: "succeeded" | "failed",
  errorMessage?: string
): Promise<void> {
  await db
    .update(schema.promptArtifacts)
    .set({
      status,
      errorMessage: errorMessage ?? null,
    })
    .where(eq(schema.promptArtifacts.id, eventId));
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

  const reserved = await reserveWebhookEvent(event);
  if (!reserved) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
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
        const shipping = extractShippingPayload(session);
        await db
          .update(schema.orders)
          .set({
            paymentStatus: "paid",
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
            shippingName: shipping.shippingName,
            shippingEmail: shipping.shippingEmail,
            shippingPhone: shipping.shippingPhone,
            shippingAddressJson: shipping.shippingAddressJson,
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

        if (order.userId) {
          await grantPaidRerollCreditsForOrder({
            userId: order.userId,
            orderId: order.id,
          });
        }

        if (getAutoGenerateAfterPayment()) {
          try {
            await inngest.send({
              name: "order/paid",
              data: {
                orderId: order.id,
              },
            });
          } catch {
            // Keep webhook success path resilient; Inngest retries are handled separately.
          }
        }
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.id) {
        await db
          .update(schema.orders)
          .set({ paymentStatus: "expired" })
          .where(
            and(
              eq(schema.orders.stripeCheckoutSessionId, session.id),
              eq(schema.orders.paymentStatus, "pending")
            )
          );
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      await db
        .update(schema.orders)
        .set({ paymentStatus: "failed" })
        .where(
          and(
            eq(schema.orders.stripePaymentIntentId, intent.id),
            eq(schema.orders.paymentStatus, "pending")
          )
        );
    }

    await markWebhookEventProcessed(event.id, "succeeded");
  } catch (error) {
    await markWebhookEventProcessed(
      event.id,
      "failed",
      error instanceof Error ? error.message : "Webhook processing failed"
    );
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
