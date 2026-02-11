import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CustomerBookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Book #{id}</h1>
          <p className="text-sm text-muted-foreground">
            Phase 8 scaffold: customer status + download page.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/books">Back to My Books</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Payment: pending (placeholder)</p>
          <p>Fulfillment: queued (placeholder)</p>
          <p>Tracking: unavailable (placeholder)</p>
        </CardContent>
      </Card>
    </div>
  );
}
