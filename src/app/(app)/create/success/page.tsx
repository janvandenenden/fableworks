import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db, schema } from "@/db";

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

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string | string[] }>;
}) {
  const userId = await getCurrentUserIdOrFallback();
  const params = await searchParams;
  const sessionId = Array.isArray(params.session_id) ? params.session_id[0] : params.session_id;

  const orderRows = sessionId
    ? await db
        .select({
          id: schema.orders.id,
          userId: schema.orders.userId,
          paymentStatus: schema.orders.paymentStatus,
          createdAt: schema.orders.createdAt,
        })
        .from(schema.orders)
        .where(eq(schema.orders.stripeCheckoutSessionId, sessionId))
        .orderBy(desc(schema.orders.createdAt))
        .limit(1)
    : [];
  const order = orderRows[0];
  const isOwner = Boolean(order && order.userId === userId);

  if (!isOwner) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold">Payment received</h1>
        <p className="text-sm text-muted-foreground">
          We could not match this checkout session to your account view.
        </p>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/books">Go to My Books</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/create/character">Create Another Book</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">You did it. Your book is in motion.</h1>
        <p className="text-sm text-muted-foreground">
          Payment confirmed. We sent you an email and are now preparing everything behind the scenes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What happens next</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. We process your personalized book.</p>
          <p>2. You get status emails as it moves to print and shipping.</p>
          <p>3. You can follow the order anytime from your account.</p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/books">Track My Order</Link>
        </Button>
        {sessionId ? (
          <Button asChild variant="outline">
            <Link href={`/create/generating?session_id=${sessionId}`}>View Processing Details</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
