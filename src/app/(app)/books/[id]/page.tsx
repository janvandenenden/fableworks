import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db, schema } from "@/db";
import {
  toCustomerFulfillmentStatus,
  toCustomerPaymentStatus,
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

export default async function CustomerBookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: bookId } = await params;
  const userId = await getCurrentUserIdOrFallback();

  const bookRows = await db
    .select({
      id: schema.books.id,
      orderId: schema.books.orderId,
      pdfUrl: schema.books.pdfUrl,
      printStatus: schema.books.printStatus,
      trackingUrl: schema.books.trackingUrl,
      updatedAt: schema.books.updatedAt,
    })
    .from(schema.books)
    .where(eq(schema.books.id, bookId))
    .limit(1);
  const book = bookRows[0];

  if (!book || !book.orderId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold">Book not found</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/books">Back to My Books</Link>
        </Button>
      </div>
    );
  }

  const orderRows = await db
    .select({
      id: schema.orders.id,
      userId: schema.orders.userId,
      storyId: schema.orders.storyId,
      paymentStatus: schema.orders.paymentStatus,
      amountCents: schema.orders.amountCents,
      currency: schema.orders.currency,
      shippingName: schema.orders.shippingName,
      shippingEmail: schema.orders.shippingEmail,
      shippingPhone: schema.orders.shippingPhone,
      shippingAddressJson: schema.orders.shippingAddressJson,
      createdAt: schema.orders.createdAt,
    })
    .from(schema.orders)
    .where(eq(schema.orders.id, book.orderId))
    .limit(1);
  const order = orderRows[0];

  if (!order || order.userId !== userId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold">Book not found</h1>
        <p className="text-sm text-muted-foreground">This book is not accessible from your account.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/books">Back to My Books</Link>
        </Button>
      </div>
    );
  }

  const [story] = order.storyId
    ? await db
        .select({ title: schema.stories.title })
        .from(schema.stories)
        .where(eq(schema.stories.id, order.storyId))
        .limit(1)
    : [];
  const pipelineRuns = await db
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
    .limit(10);

  const latestFiles = await db
    .select({
      type: schema.generatedAssets.type,
      storageUrl: schema.generatedAssets.storageUrl,
    })
    .from(schema.generatedAssets)
    .where(eq(schema.generatedAssets.entityId, book.id))
    .orderBy(desc(schema.generatedAssets.createdAt))
    .limit(20);

  const interiorPdfUrl =
    latestFiles.find((asset) => asset.type === "book_pdf_interior")?.storageUrl ?? book.pdfUrl;
  const coverPdfUrl =
    latestFiles.find((asset) => asset.type === "book_pdf_cover")?.storageUrl ?? null;

  const payment = toCustomerPaymentStatus(order.paymentStatus);
  const fulfillment = toCustomerFulfillmentStatus(book.printStatus);
  const storyTitle = story?.title?.trim() || "Untitled story";
  const shippingAddress = (() => {
    const raw = order.shippingAddressJson;
    if (!raw) return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as {
          line1?: string;
          line2?: string;
          city?: string;
          state?: string;
          postal_code?: string;
          country?: string;
        };
      } catch {
        return null;
      }
    }
    if (typeof raw === "object") {
      return raw as {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        postal_code?: string;
        country?: string;
      };
    }
    return null;
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{storyTitle}</h1>
          <p className="text-sm text-muted-foreground">
            Order {order.id} • Book {book.id}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/books">Back to My Books</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className={`rounded-md border p-3 ${toToneClasses(payment.tone)}`}>
            <p className="font-medium">Payment: {payment.label}</p>
            <p className="text-xs">{payment.detail}</p>
          </div>
          <div className={`rounded-md border p-3 ${toToneClasses(fulfillment.tone)}`}>
            <p className="font-medium">Fulfillment: {fulfillment.label}</p>
            <p className="text-xs">{fulfillment.detail}</p>
          </div>
          <p className="text-muted-foreground">
            Tracking:{" "}
            {book.trackingUrl ? (
              <a
                className="underline underline-offset-4"
                href={book.trackingUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open shipment tracking
              </a>
            ) : (
              "Not available yet"
            )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {interiorPdfUrl ? (
            <Button asChild size="sm">
              <a href={interiorPdfUrl} target="_blank" rel="noreferrer">
                Download Interior PDF
              </a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Interior PDF not available yet.</p>
          )}
          {coverPdfUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={coverPdfUrl} target="_blank" rel="noreferrer">
                Download Cover PDF
              </a>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href="/create/character">Create Another Book</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shipping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>{order.shippingName || "Name not provided"}</p>
          {shippingAddress ? (
            <>
              <p>{shippingAddress.line1 || ""}</p>
              {shippingAddress.line2 ? <p>{shippingAddress.line2}</p> : null}
              <p>
                {shippingAddress.city || ""} {shippingAddress.state || ""} {shippingAddress.postal_code || ""}
              </p>
              <p>{shippingAddress.country || ""}</p>
            </>
          ) : (
            <p>Shipping address will appear after checkout completion.</p>
          )}
          {order.shippingEmail ? <p>Email: {order.shippingEmail}</p> : null}
          {order.shippingPhone ? <p>Phone: {order.shippingPhone}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Processing Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {pipelineRuns.length === 0 ? (
            <p className="text-muted-foreground">Queued for processing.</p>
          ) : (
            pipelineRuns.map((run) => (
              <div key={run.id} className="rounded-md border bg-muted/30 p-2">
                <p className="font-medium">
                  {run.status === "failed"
                    ? "Failed"
                    : run.status === "running"
                      ? "Running"
                      : "Completed"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {run.errorMessage
                    ? run.errorMessage
                    : run.structuredFields
                      ? String(run.structuredFields)
                      : "No details"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
