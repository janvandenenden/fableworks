import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { toCustomerFulfillmentStatus, toCustomerPaymentStatus } from "@/lib/order-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteOrderButton } from "@/components/app/delete-order-button";

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

function formatMoney(amountCents: number | null, currency: string | null): string {
  if (typeof amountCents !== "number" || !Number.isFinite(amountCents)) {
    return "Pending price";
  }
  if (typeof currency !== "string" || currency.trim().length === 0) {
    return "Pending currency";
  }
  const amount = amountCents;
  const safeCurrency = currency.toUpperCase();
  return `${(amount / 100).toFixed(2)} ${safeCurrency}`;
}

export default async function CustomerBooksPage() {
  const userId = await getCurrentUserIdOrFallback();
  const orders = await db
    .select({
      id: schema.orders.id,
      storyId: schema.orders.storyId,
      paymentStatus: schema.orders.paymentStatus,
      amountCents: schema.orders.amountCents,
      currency: schema.orders.currency,
      createdAt: schema.orders.createdAt,
    })
    .from(schema.orders)
    .where(eq(schema.orders.userId, userId))
    .orderBy(desc(schema.orders.createdAt))
    .limit(20);

  const rows = await Promise.all(
    orders.map(async (order) => {
      const [story] = order.storyId
        ? await db
            .select({ title: schema.stories.title })
            .from(schema.stories)
            .where(eq(schema.stories.id, order.storyId))
            .limit(1)
        : [];

      const [book] = await db
        .select({
          id: schema.books.id,
          printStatus: schema.books.printStatus,
          trackingUrl: schema.books.trackingUrl,
        })
        .from(schema.books)
        .where(eq(schema.books.orderId, order.id))
        .orderBy(desc(schema.books.createdAt))
        .limit(1);

      return {
        order,
        storyTitle: story?.title?.trim() || "Untitled story",
        book: book ?? null,
      };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">My Books</h1>
        <p className="text-sm text-muted-foreground">
          View your orders, payment status, and fulfillment progress.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No books yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Complete checkout to see your personalized books in this library.
            </p>
            <div className="flex gap-2">
              <Button asChild>
                <Link href="/create/character">Create a Book</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rows.map(({ order, storyTitle, book }) => {
            const payment = toCustomerPaymentStatus(order.paymentStatus);
            const fulfillment = toCustomerFulfillmentStatus(book?.printStatus);
            const canRetryCheckout =
              Boolean(order.storyId) &&
              (order.paymentStatus === "failed" || order.paymentStatus === "expired");
            const canResumeCheckout =
              Boolean(order.storyId) && order.paymentStatus === "pending";
            const canDeleteOrder =
              order.paymentStatus === "pending" ||
              order.paymentStatus === "failed" ||
              order.paymentStatus === "expired";

            return (
              <Card key={order.id}>
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl">{storyTitle}</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    Order {order.id.slice(0, 8)} • {formatMoney(order.amountCents, order.currency)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="font-medium">Payment</p>
                      <p>{payment.label}</p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="font-medium">Fulfillment</p>
                      <p>{fulfillment.label}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {book ? (
                      <Button asChild size="sm">
                        <Link href={`/books/${book.id}`}>Open Book</Link>
                      </Button>
                    ) : null}
                    {canRetryCheckout ? (
                      <Button asChild size="sm">
                        <Link href={`/create/checkout?storyId=${order.storyId}`}>Retry Checkout</Link>
                      </Button>
                    ) : null}
                    {canResumeCheckout ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/create/checkout?storyId=${order.storyId}`}>Complete Checkout</Link>
                      </Button>
                    ) : null}
                    {!book ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href="/create/generating">Open Processing Status</Link>
                      </Button>
                    ) : null}
                    {book?.trackingUrl ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={book.trackingUrl} target="_blank" rel="noreferrer">
                          Track Shipment
                        </a>
                      </Button>
                    ) : null}
                    {canDeleteOrder ? <DeleteOrderButton orderId={order.id} /> : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
