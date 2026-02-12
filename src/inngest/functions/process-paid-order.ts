import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { inngest } from "@/inngest/client";
import { generatePrintFilesForStory } from "@/lib/book-generation";

const orderPaidSchema = z.object({
  orderId: z.string().uuid(),
});

function newId(): string {
  return crypto.randomUUID();
}

function isPreconditionWaitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("No scenes found") ||
    error.message.includes("Missing final pages")
  );
}

export const processPaidOrder = inngest.createFunction(
  { id: "process-paid-order" },
  { event: "order/paid" },
  async ({ event, step }) => {
    const payload = orderPaidSchema.parse(event.data);
    const runId = newId();

    return await step.run("process-order", async () => {
      const orderRows = await db
        .select({
          id: schema.orders.id,
          storyId: schema.orders.storyId,
          paymentStatus: schema.orders.paymentStatus,
        })
        .from(schema.orders)
        .where(eq(schema.orders.id, payload.orderId))
        .limit(1);
      const order = orderRows[0];
      if (!order || !order.storyId) {
        return { ok: false, reason: "order_or_story_missing" };
      }

      if (order.paymentStatus !== "paid") {
        return { ok: false, reason: "order_not_paid" };
      }

      const bookRows = await db
        .select({
          id: schema.books.id,
          orderId: schema.books.orderId,
        })
        .from(schema.books)
        .where(eq(schema.books.orderId, order.id))
        .limit(1);
      const book =
        bookRows[0] ??
        (
          await db
            .insert(schema.books)
            .values({
              id: newId(),
              orderId: order.id,
              printStatus: "pending_generation",
            })
            .returning()
        )[0];

      await db
        .update(schema.books)
        .set({
          printStatus: "pending_generation",
          updatedAt: new Date(),
        })
        .where(eq(schema.books.id, book.id));

      await db.insert(schema.promptArtifacts).values({
        id: runId,
        entityType: "order_generation_pipeline",
        entityId: order.id,
        rawPrompt: "Process paid order into print files",
        model: "internal-pipeline",
        status: "running",
        parameters: JSON.stringify({
          stage: "queued",
          orderId: order.id,
          storyId: order.storyId,
          bookId: book.id,
        }),
      });

      try {
        const generated = await generatePrintFilesForStory(order.storyId);
        await db
          .update(schema.promptArtifacts)
          .set({
            status: "success",
            structuredFields: JSON.stringify({
              stage: "complete",
              orderId: order.id,
              storyId: order.storyId,
              bookId: generated.bookId,
              interiorUrl: generated.interiorUrl,
              coverUrl: generated.coverUrl,
            }),
          })
          .where(eq(schema.promptArtifacts.id, runId));

        return {
          ok: true,
          stage: "complete",
          orderId: order.id,
          bookId: generated.bookId,
        };
      } catch (error) {
        if (isPreconditionWaitError(error)) {
          await db
            .update(schema.promptArtifacts)
            .set({
              status: "success",
              structuredFields: JSON.stringify({
                stage: "waiting_for_assets",
                orderId: order.id,
                storyId: order.storyId,
                bookId: book.id,
                note: error instanceof Error ? error.message : "Waiting for final assets",
              }),
            })
            .where(eq(schema.promptArtifacts.id, runId));

          return {
            ok: true,
            stage: "waiting_for_assets",
            orderId: order.id,
            bookId: book.id,
          };
        }

        await db
          .update(schema.books)
          .set({
            printStatus: "errored",
            updatedAt: new Date(),
          })
          .where(eq(schema.books.id, book.id));

        await db
          .update(schema.promptArtifacts)
          .set({
            status: "failed",
            errorMessage:
              error instanceof Error ? error.message : "Order pipeline processing failed",
          })
          .where(eq(schema.promptArtifacts.id, runId));

        throw error;
      }
    });
  }
);
