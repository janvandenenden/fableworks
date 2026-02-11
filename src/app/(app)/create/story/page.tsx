import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CreateStoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Select a Story</h1>
        <p className="text-sm text-muted-foreground">
          Phase 8 scaffold: story catalog and selection state will live here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Story Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pick a story template before checkout.
          </p>
          <Button asChild>
            <Link href="/create/checkout">Continue to Checkout</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
