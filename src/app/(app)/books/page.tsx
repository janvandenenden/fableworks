import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CustomerBooksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">My Books</h1>
        <p className="text-sm text-muted-foreground">
          Phase 8 scaffold: purchased books and status timeline will appear here.
        </p>
      </div>

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
            <Button asChild variant="outline">
              <Link href="/books/demo">Open Demo Book Detail</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
