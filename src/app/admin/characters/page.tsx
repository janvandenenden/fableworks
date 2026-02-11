import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { CharacterForm } from "@/components/admin/character-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CharactersPage() {
  const characters = await db
    .select()
    .from(schema.characters)
    .orderBy(desc(schema.characters.createdAt));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Characters</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage character generations.
          </p>
        </div>
      </div>

      <CharacterForm />

      <Card>
        <CardHeader>
          <CardTitle>Recent characters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {characters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No characters created yet.
            </p>
          ) : (
            characters.map((character) => (
              <div
                key={character.id}
                className="flex items-center justify-between rounded-md border px-4 py-3"
              >
                <div>
                  <p className="font-medium">{character.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {character.gender} · {character.status}
                  </p>
                </div>
                <Link
                  href={`/admin/characters/${character.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  View
                </Link>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
