"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const DELETABLE_PAYMENT_STATUSES = new Set(["pending", "failed", "expired"]);

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

export async function deleteUnpaidOrderAction(orderId: string): Promise<ActionResult<{ orderId: string }>> {
  const trimmedOrderId = orderId.trim();
  if (!trimmedOrderId) {
    return { success: false, error: "Missing order id" };
  }

  const userId = await getCurrentUserIdOrFallback();
  const orderRows = await db
    .select({
      id: schema.orders.id,
      userId: schema.orders.userId,
      paymentStatus: schema.orders.paymentStatus,
    })
    .from(schema.orders)
    .where(eq(schema.orders.id, trimmedOrderId))
    .limit(1);
  const order = orderRows[0];

  if (!order || order.userId !== userId) {
    return { success: false, error: "Order not found" };
  }

  if (!DELETABLE_PAYMENT_STATUSES.has(order.paymentStatus ?? "")) {
    return { success: false, error: "Only unpaid test orders can be deleted" };
  }

  const bookRows = await db
    .select({ id: schema.books.id })
    .from(schema.books)
    .where(eq(schema.books.orderId, order.id));
  const bookIds = bookRows.map((row) => row.id);

  // Cleanup linked artifacts first to avoid dangling test data.
  if (bookIds.length > 0) {
    await db
      .delete(schema.generatedAssets)
      .where(inArray(schema.generatedAssets.entityId, bookIds));
    await db
      .delete(schema.promptArtifacts)
      .where(
        and(
          eq(schema.promptArtifacts.entityType, "order_generation_pipeline"),
          eq(schema.promptArtifacts.entityId, order.id)
        )
      );
    await db
      .delete(schema.promptArtifacts)
      .where(
        and(
          eq(schema.promptArtifacts.entityType, "order_generation_pipeline_retry"),
          eq(schema.promptArtifacts.entityId, order.id)
        )
      );
    await db
      .delete(schema.promptArtifacts)
      .where(
        and(
          eq(schema.promptArtifacts.entityType, "email_notification"),
          eq(schema.promptArtifacts.entityId, order.id)
        )
      );
    await db.delete(schema.books).where(eq(schema.books.orderId, order.id));
  } else {
    await db
      .delete(schema.promptArtifacts)
      .where(
        and(
          eq(schema.promptArtifacts.entityType, "order_generation_pipeline"),
          eq(schema.promptArtifacts.entityId, order.id)
        )
      );
    await db
      .delete(schema.promptArtifacts)
      .where(
        and(
          eq(schema.promptArtifacts.entityType, "order_generation_pipeline_retry"),
          eq(schema.promptArtifacts.entityId, order.id)
        )
      );
    await db
      .delete(schema.promptArtifacts)
      .where(
        and(
          eq(schema.promptArtifacts.entityType, "email_notification"),
          eq(schema.promptArtifacts.entityId, order.id)
        )
      );
  }

  await db.delete(schema.creditLedgerEntries).where(eq(schema.creditLedgerEntries.orderId, order.id));
  await db.delete(schema.orders).where(eq(schema.orders.id, order.id));

  revalidatePath("/books");
  revalidatePath("/create/generating");

  return { success: true, data: { orderId: order.id } };
}
