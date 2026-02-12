import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { db, schema } from "@/db";
import {
  toCustomerFulfillmentStatus,
  toCustomerPaymentStatus,
  toCustomerPipelineStatus,
  toToneClasses,
} from "@/lib/order-status";

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

export default async function CreateGeneratingPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const userId = await getCurrentUserIdOrFallback();
  const params = await searchParams;

  const orderRows = params.session_id
    ? await db
        .select({
          id: schema.orders.id,
          userId: schema.orders.userId,
          paymentStatus: schema.orders.paymentStatus,
        })
        .from(schema.orders)
        .where(eq(schema.orders.stripeCheckoutSessionId, params.session_id))
        .orderBy(desc(schema.orders.createdAt))
        .limit(1)
    : [];
  const order = orderRows[0];
  const orderBelongsToUser = Boolean(order && order.userId === userId);

  const bookRows =
    order && orderBelongsToUser
      ? await db
          .select({
            id: schema.books.id,
            printStatus: schema.books.printStatus,
          })
          .from(schema.books)
          .where(eq(schema.books.orderId, order.id))
          .orderBy(desc(schema.books.createdAt))
          .limit(1)
      : [];
  const book = bookRows[0] ?? null;
  const pipelineRuns =
    order && orderBelongsToUser
      ? await db
          .select({
            id: schema.promptArtifacts.id,
            status: schema.promptArtifacts.status,
            structuredFields: schema.promptArtifacts.structuredFields,
            errorMessage: schema.promptArtifacts.errorMessage,
            createdAt: schema.promptArtifacts.createdAt,
          })
          .from(schema.promptArtifacts)
          .where(
            and(
              eq(schema.promptArtifacts.entityType, "order_generation_pipeline"),
              eq(schema.promptArtifacts.entityId, order.id)
            )
          )
          .orderBy(desc(schema.promptArtifacts.createdAt))
          .limit(5)
      : [];
  const latestRun = pipelineRuns[0] ?? null;

  const payment = toCustomerPaymentStatus(order?.paymentStatus);
  const fulfillment = toCustomerFulfillmentStatus(book?.printStatus);
  const pipeline = toCustomerPipelineStatus(latestRun);
  const progressValue =
    order?.paymentStatus === "paid" ? (book?.printStatus === "shipped" || book?.printStatus === "delivered" ? 100 : 55) : 25;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Preparing Your Book</h1>
        <p className="text-sm text-muted-foreground">
          Payment completed. We are now preparing your book files and fulfillment status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generation Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {orderBelongsToUser ? (
            <>
              <div className={`rounded-md border p-3 text-sm ${toToneClasses(payment.tone)}`}>
                <p className="font-medium">Payment: {payment.label}</p>
                <p className="text-xs">{payment.detail}</p>
              </div>
              <div className={`rounded-md border p-3 text-sm ${toToneClasses(fulfillment.tone)}`}>
                <p className="font-medium">Fulfillment: {fulfillment.label}</p>
                <p className="text-xs">{fulfillment.detail}</p>
              </div>
              <div className={`rounded-md border p-3 text-sm ${toToneClasses(pipeline.tone)}`}>
                <p className="font-medium">Processing: {pipeline.label}</p>
                <p className="text-xs">{pipeline.detail}</p>
              </div>
              <Progress value={progressValue} />
              <div className="flex gap-2">
                {book ? (
                  <Button asChild size="sm">
                    <Link href={`/books/${book.id}`}>Open Book Status</Link>
                  </Button>
                ) : null}
                <Button asChild variant="outline" size="sm">
                  <Link href="/books">Go to My Books</Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                We could not map this checkout session to your account yet.
              </p>
              <Progress value={25} />
              <Button asChild variant="outline" size="sm">
                <Link href="/books">Go to My Books</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
