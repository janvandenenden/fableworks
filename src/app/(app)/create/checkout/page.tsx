import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
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
  searchParams: Promise<{
    canceled?: string | string[];
    storyId?: string | string[];
    characterId?: string | string[];
    forceNew?: string | string[];
  }>;
}) {
  const userId = await getCurrentUserIdOrNull();
  const params = await searchParams;
  const asSingle = (value: string | string[] | undefined): string | null =>
    Array.isArray(value) ? (value[0] ?? null) : value ?? null;
  const canceled = asSingle(params.canceled);
  const storyId = asSingle(params.storyId);
  const characterId = asSingle(params.characterId);
  const forceNew = asSingle(params.forceNew);
  const credits = userId ? await getUserCreditSnapshot(userId) : null;

  const story = storyId
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
          .where(eq(schema.stories.id, storyId))
          .limit(1)
      )[0]
    : null;

  const character = characterId
    ? (
        await db
          .select({
            id: schema.characters.id,
            userId: schema.characters.userId,
            name: schema.characters.name,
            status: schema.characters.status,
          })
          .from(schema.characters)
          .where(eq(schema.characters.id, characterId))
          .limit(1)
      )[0]
    : null;

  const isStoryOwnedByViewer = story
    ? (userId ? story.userId === userId : story.userId === null)
    : false;
  const isCharacterOwnedByViewer = character
    ? (userId ? character.userId === userId : character.userId === null)
    : true;
  const latestOrderForStory =
    story && userId
      ? (
          await db
            .select({
              id: schema.orders.id,
              paymentStatus: schema.orders.paymentStatus,
              createdAt: schema.orders.createdAt,
            })
            .from(schema.orders)
            .where(and(eq(schema.orders.userId, userId), eq(schema.orders.storyId, story.id)))
            .orderBy(desc(schema.orders.createdAt))
            .limit(1)
        )[0] ?? null
      : null;
  const isRetryFlow =
    latestOrderForStory?.paymentStatus === "failed" ||
    latestOrderForStory?.paymentStatus === "expired";
  const isAlreadyPaid = latestOrderForStory?.paymentStatus === "paid" && forceNew !== "1";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Checkout</h1>
        <p className="text-sm text-muted-foreground">
          Enter shipping details in Stripe, pay, and we handle generation + print fulfillment.
        </p>
      </div>

      {canceled === "1" ? (
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
          ) : isAlreadyPaid ? (
            <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-900">
                This story already has a paid checkout. Open your books library to track fulfillment.
              </p>
              <div className="flex gap-2">
                <Button asChild>
                  <Link href="/books">Go to My Books</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/create/checkout?storyId=${story.id}&forceNew=1`}>
                    Start New Checkout Anyway
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {latestOrderForStory?.paymentStatus === "pending" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  You have a pending order for this story. Continue checkout to complete payment.
                </div>
              ) : null}
              {isRetryFlow ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Previous checkout was {latestOrderForStory.paymentStatus}. Retry payment below.
                </div>
              ) : null}

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
                  <Button type="submit">
                    {isRetryFlow ? "Retry Checkout" : "Continue to Stripe Checkout"}
                  </Button>
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

              {latestOrderForStory ? (
                <p className="text-xs text-muted-foreground">
                  Latest order: {latestOrderForStory.id.slice(0, 8)} ({latestOrderForStory.paymentStatus})
                </p>
              ) : null}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Test mode checkout only. Real charge settings remain disabled until Phase 8 validation is complete.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
