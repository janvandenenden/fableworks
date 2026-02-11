import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { desc, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CharacterDetailPage({ params }: Props) {
  const { id } = await params;
  const character = await db
    .select()
    .from(schema.characters)
    .where(eq(schema.characters.id, id))
    .limit(1);

  if (!character[0]) {
    notFound();
  }

  const item = character[0];
  const profile = await db
    .select()
    .from(schema.characterProfiles)
    .where(eq(schema.characterProfiles.characterId, id))
    .limit(1);
  const images = await db
    .select()
    .from(schema.characterImages)
    .where(eq(schema.characterImages.characterId, id))
    .orderBy(desc(schema.characterImages.createdAt));
  const latestProfile = profile[0] ?? null;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{item.name}</h1>
          <Badge variant="secondary">{item.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{item.gender}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>Style: {item.stylePreset ?? "storybook"}</div>
          <div>
            Source image:{" "}
            {item.sourceImageUrl ? (
              <a
                href={item.sourceImageUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                View
              </a>
            ) : (
              "none"
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!latestProfile ? (
            <p className="text-muted-foreground">
              Profile not generated yet. Check Inngest logs.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>Approx age: {latestProfile.approxAge ?? "—"}</div>
              <div>Hair color: {latestProfile.hairColor ?? "—"}</div>
              <div>Hair length: {latestProfile.hairLength ?? "—"}</div>
              <div>Hair texture: {latestProfile.hairTexture ?? "—"}</div>
              <div>Hair style: {latestProfile.hairStyle ?? "—"}</div>
              <div>Face shape: {latestProfile.faceShape ?? "—"}</div>
              <div>Eye color: {latestProfile.eyeColor ?? "—"}</div>
              <div>Eye shape: {latestProfile.eyeShape ?? "—"}</div>
              <div>Skin tone: {latestProfile.skinTone ?? "—"}</div>
              <div>Clothing: {latestProfile.clothing ?? "—"}</div>
              <div>
                Distinctive features:{" "}
                {latestProfile.distinctiveFeatures ?? "—"}
              </div>
              <div>
                Color palette:{" "}
                {latestProfile.colorPalette
                  ? JSON.stringify(latestProfile.colorPalette)
                  : "—"}
              </div>
              <div>
                Personality traits:{" "}
                {latestProfile.personalityTraits
                  ? JSON.stringify(latestProfile.personalityTraits)
                  : "—"}
              </div>
              <div>
                Do not change:{" "}
                {latestProfile.doNotChange
                  ? JSON.stringify(latestProfile.doNotChange)
                  : "—"}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated images</CardTitle>
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No generated images yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="overflow-hidden rounded-lg border bg-muted/20"
                >
                  <div className="relative aspect-[4/5] w-full">
                    <Image
                      src={image.imageUrl}
                      alt={`Character ${item.name}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="p-3 text-xs text-muted-foreground">
                    {image.isSelected ? "Selected" : "Variant"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
