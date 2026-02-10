import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  params: { id: string };
};

export default async function CharacterDetailPage({ params }: Props) {
  const character = await db
    .select()
    .from(schema.characters)
    .where(eq(schema.characters.id, params.id))
    .limit(1);

  if (!character[0]) {
    notFound();
  }

  const item = character[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{item.name}</h1>
        <p className="text-sm text-muted-foreground">
          {item.gender} · {item.status}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>Style: {item.stylePreset ?? "storybook"}</div>
          <div>Source image: {item.sourceImageUrl ?? "none"}</div>
        </CardContent>
      </Card>
    </div>
  );
}
