import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function CreateGeneratingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Preparing Your Book</h1>
        <p className="text-sm text-muted-foreground">
          Phase 8 scaffold: customer-friendly fulfillment progress will appear here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generation Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Waiting for paid order processing.</p>
          <Progress value={25} />
        </CardContent>
      </Card>
    </div>
  );
}
