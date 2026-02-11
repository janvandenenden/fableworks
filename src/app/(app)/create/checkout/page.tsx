import Link from "next/link";
import { desc, eq, isNull } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db, schema } from "@/db";
import { createCheckoutSessionAction } from "./actions";

async function getCurrentUserIdOrNull(): Promise<string | null> {
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const authResult = await auth();
    return authResult?.userId ?? null;
  } catch {
    return null;
  }
}

export default async function CreateCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string; storyId?: string }>;
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
        .limit(12)
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
        .limit(12);

  const characters = userId
    ? await db
        .select({
          id: schema.characters.id,
          name: schema.characters.name,
          status: schema.characters.status,
        })
        .from(schema.characters)
        .where(eq(schema.characters.userId, userId))
        .orderBy(desc(schema.characters.updatedAt))
        .limit(12)
    : await db
        .select({
          id: schema.characters.id,
          name: schema.characters.name,
          status: schema.characters.status,
        })
        .from(schema.characters)
        .where(isNull(schema.characters.userId))
        .orderBy(desc(schema.characters.updatedAt))
        .limit(12);

  const selectedStoryId =
    (params.storyId && stories.some((story) => story.id === params.storyId) ? params.storyId : null) ??
    stories[0]?.id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Checkout</h1>
        <p className="text-sm text-muted-foreground">
          Pay first, then we trigger expensive page and print-file generation.
        </p>
      </div>

      {params.canceled === "1" ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-900">
            Checkout was canceled. You can retry payment whenever you are ready.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Step 3: Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Select the story + character label you are buying, then continue to Stripe test checkout.
          </p>

          {stories.length === 0 ? (
            <div className="space-y-3 rounded-md border border-dashed p-4">
              <p className="text-sm text-muted-foreground">
                No draft stories found yet. Start at Step 1 and Step 2 first.
              </p>
              <Button asChild>
                <Link href="/create/story">Go to Story Selection</Link>
              </Button>
            </div>
          ) : (
            <form action={createCheckoutSessionAction} className="space-y-4 rounded-md border p-4">
              <div className="space-y-2">
                <label htmlFor="storyId" className="text-sm font-medium">
                  Story
                </label>
                <select
                  id="storyId"
                  name="storyId"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  defaultValue={selectedStoryId}
                  required
                >
                  {stories.map((story) => (
                    <option key={story.id} value={story.id}>
                      {(story.title?.trim() || "Untitled story")} ({story.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="characterLabel" className="text-sm font-medium">
                  Character Label (optional)
                </label>
                <select
                  id="characterLabel"
                  name="characterLabel"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  defaultValue=""
                >
                  <option value="">No explicit character</option>
                  {characters.map((character) => (
                    <option key={character.id} value={character.name}>
                      {character.name} ({character.status})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  This label is stored in checkout metadata for correlation and post-payment generation.
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="submit">Continue to Stripe Checkout</Button>
                <Button asChild variant="outline">
                  <Link href="/books">Go to My Books</Link>
                </Button>
              </div>
            </form>
          )}

          <div className="text-xs text-muted-foreground">
            Test mode checkout only. Real charge settings remain disabled until Phase 8 validation is complete.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
