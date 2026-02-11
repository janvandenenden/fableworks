import Link from "next/link";
import { desc, eq, isNull } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db, schema } from "@/db";

async function getCurrentUserIdOrNull(): Promise<string | null> {
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const authResult = await auth();
    return authResult?.userId ?? null;
  } catch {
    return null;
  }
}

export default async function CreateStoryPage({
  searchParams,
}: {
  searchParams: Promise<{ characterId?: string }>;
}) {
  const userId = await getCurrentUserIdOrNull();
  const params = await searchParams;

  const stories = userId
    ? await db
        .select({
          id: schema.stories.id,
          title: schema.stories.title,
          theme: schema.stories.theme,
          status: schema.stories.status,
          updatedAt: schema.stories.updatedAt,
        })
        .from(schema.stories)
        .where(eq(schema.stories.userId, userId))
        .orderBy(desc(schema.stories.updatedAt))
        .limit(20)
    : await db
        .select({
          id: schema.stories.id,
          title: schema.stories.title,
          theme: schema.stories.theme,
          status: schema.stories.status,
          updatedAt: schema.stories.updatedAt,
        })
        .from(schema.stories)
        .where(isNull(schema.stories.userId))
        .orderBy(desc(schema.stories.updatedAt))
        .limit(20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Select a Story</h1>
        <p className="text-sm text-muted-foreground">
          Step 2: pick one story for your selected character.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Story Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stories.length === 0 ? (
            <div className="space-y-3 rounded-md border border-dashed p-4">
              <p className="text-sm text-muted-foreground">
                No stories found yet. Create one in admin for now, then return here.
              </p>
              <Button asChild variant="outline">
                <Link href="/admin/stories">Open Story Studio</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {stories.map((story) => {
                const title = story.title?.trim() || "Untitled story";
                const paramsForCheckout = new URLSearchParams();
                paramsForCheckout.set("storyId", story.id);
                if (params.characterId) {
                  paramsForCheckout.set("characterId", params.characterId);
                }
                return (
                  <div
                    key={story.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">
                        Theme: {story.theme || "n/a"} • Status: {story.status}
                      </p>
                    </div>
                    <Button asChild>
                      <Link href={`/create/checkout?${paramsForCheckout.toString()}`}>
                        Continue with this story
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
