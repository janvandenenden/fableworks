import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CreateCharacterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Create Your Character</h1>
        <p className="text-sm text-muted-foreground">
          Phase 8 scaffold: customer character creation UI will live here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Character Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload a child photo and choose style preferences to prepare the book.
          </p>
          <Button asChild>
            <Link href="/create/story">Continue to Story Selection</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
