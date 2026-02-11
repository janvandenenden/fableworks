import Link from "next/link";
import { desc, eq, isNull } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db, schema } from "@/db";
import { getUserCreditSnapshot } from "@/lib/credits";

async function getCurrentUserIdOrNull(): Promise<string | null> {
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const authResult = await auth();
    return authResult?.userId ?? null;
  } catch {
    return null;
  }
}

export default async function CreateCharacterPage() {
  const userId = await getCurrentUserIdOrNull();
  const credits = userId ? await getUserCreditSnapshot(userId) : null;
  const characters = userId
    ? await db
        .select({
          id: schema.characters.id,
          name: schema.characters.name,
          status: schema.characters.status,
          updatedAt: schema.characters.updatedAt,
        })
        .from(schema.characters)
        .where(eq(schema.characters.userId, userId))
        .orderBy(desc(schema.characters.updatedAt))
        .limit(20)
    : await db
        .select({
          id: schema.characters.id,
          name: schema.characters.name,
          status: schema.characters.status,
          updatedAt: schema.characters.updatedAt,
        })
        .from(schema.characters)
        .where(isNull(schema.characters.userId))
        .orderBy(desc(schema.characters.updatedAt))
        .limit(20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Create Your Character</h1>
        <p className="text-sm text-muted-foreground">
          Step 1: choose your character, then continue to story selection.
        </p>
      </div>

      {credits ? (
        <Card>
          <CardHeader>
            <CardTitle>Starter Credits</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Starter balance: <span className="font-medium text-foreground">${(credits.starterCreditsCents / 100).toFixed(2)}</span>
            {credits.hasPaidOrder ? " • Paid order detected (rerolls enabled)." : ""}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Character Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {characters.length === 0 ? (
            <div className="space-y-3 rounded-md border border-dashed p-4">
              <p className="text-sm text-muted-foreground">
                No character found yet. Create one in admin for now, then return here.
              </p>
              <Button asChild variant="outline">
                <Link href="/admin/characters">Open Character Studio</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {characters.map((character) => (
                <div
                  key={character.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{character.name}</p>
                    <p className="text-xs text-muted-foreground">Status: {character.status}</p>
                  </div>
                  <Button asChild>
                    <Link href={`/create/story?characterId=${character.id}`}>
                      Continue with {character.name}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
