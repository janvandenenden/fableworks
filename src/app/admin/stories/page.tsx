import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function StoriesPage() {
  const stories = await db
    .select()
    .from(schema.stories)
    .orderBy(desc(schema.stories.createdAt));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Stories</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage story generation outputs.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/stories/new">New story</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent stories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No stories created yet.
            </p>
          ) : (
            stories.map((story) => (
              <div
                key={story.id}
                className="flex items-center justify-between rounded-md border px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {story.title?.trim() || "Untitled story"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Age {story.ageRange ?? "n/a"}
                    {story.theme ? ` · ${story.theme}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Character: {story.characterId ? "linked" : "not linked"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{story.status}</Badge>
                  <Link
                    href={`/admin/stories/${story.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
