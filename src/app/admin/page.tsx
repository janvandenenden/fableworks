import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Manage characters, stories, and book generation.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Characters</CardTitle>
            <CardDescription>
              Manage character profiles and generated images.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">Coming in Phase 2</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stories</CardTitle>
            <CardDescription>
              Create and edit stories with scene breakdowns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">Coming in Phase 3</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
            <CardDescription>
              Track orders, payments, and print fulfillment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">Coming in Phase 7</Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
