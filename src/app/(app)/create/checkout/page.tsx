import Link from "next/link";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db, schema } from "@/db";
import { getUserCreditSnapshot } from "@/lib/credits";
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
  searchParams: Promise<{ canceled?: string; storyId?: string; characterId?: string }>;
}) {
  const userId = await getCurrentUserIdOrNull();
  const params = await searchParams;
  const credits = userId ? await getUserCreditSnapshot(userId) : null;

  const story = params.storyId
    ? (
        await db
          .select({
            id: schema.stories.id,
            userId: schema.stories.userId,
            title: schema.stories.title,
            theme: schema.stories.theme,
            status: schema.stories.status,
          })
          .from(schema.stories)
          .where(eq(schema.stories.id, params.storyId))
          .limit(1)
      )[0]
    : null;

  const character = params.characterId
    ? (
        await db
          .select({
            id: schema.characters.id,
            userId: schema.characters.userId,
            name: schema.characters.name,
            status: schema.characters.status,
          })
          .from(schema.characters)
          .where(eq(schema.characters.id, params.characterId))
          .limit(1)
      )[0]
    : null;

  const isStoryOwnedByViewer = story
    ? (userId ? story.userId === userId : story.userId === null)
    : false;
  const isCharacterOwnedByViewer = character
    ? (userId ? character.userId === userId : character.userId === null)
    : true;

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

      {credits ? (
        <Card>
          <CardHeader>
            <CardTitle>Credit Policy</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Starter balance: <span className="font-medium text-foreground">${(credits.starterCreditsCents / 100).toFixed(2)}</span>
            {credits.hasPaidOrder ? " • You already have a paid order." : " • Rerolls unlock after purchase."}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Step 3: Review &amp; Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Confirm your selections below, then continue to checkout.
          </p>

          {!story ? (
            <div className="space-y-3 rounded-md border border-dashed p-4">
              <p className="text-sm text-muted-foreground">
                Missing story selection. Complete Step 2 first.
              </p>
              <Button asChild>
                <Link href="/create/story">Go to Story Selection</Link>
              </Button>
            </div>
          ) : !isStoryOwnedByViewer || !isCharacterOwnedByViewer ? (
            <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">
                Selected story or character does not belong to your account.
              </p>
              <Button asChild variant="outline">
                <Link href="/create/character">Restart Create Flow</Link>
              </Button>
            </div>
          ) : (
            <form action={createCheckoutSessionAction} className="space-y-4 rounded-md border p-4">
              <input type="hidden" name="storyId" value={story.id} />
              {character ? <input type="hidden" name="characterId" value={character.id} /> : null}

              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <p className="text-sm">
                  <span className="font-medium">Story:</span>{" "}
                  {story.title?.trim() || "Untitled story"} ({story.status})
                </p>
                <p className="text-sm">
                  <span className="font-medium">Theme:</span> {story.theme || "n/a"}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Character:</span>{" "}
                  {character ? `${character.name} (${character.status})` : "No character selected"}
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="submit">Continue to Stripe Checkout</Button>
                <Button asChild variant="outline">
                  <Link
                    href={
                      character ? `/create/story?characterId=${character.id}` : "/create/story"
                    }
                  >
                    Edit Story
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/create/character">Edit Character</Link>
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
