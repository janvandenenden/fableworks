import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CreateCheckoutPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Checkout</h1>
        <p className="text-sm text-muted-foreground">
          Phase 8 scaffold: Stripe test checkout session starts here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step 3: Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Payment is required before expensive page generation runs.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/create/generating">Mock Continue (temporary)</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/books">Go to My Books</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
