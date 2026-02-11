import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { desc, eq } from "drizzle-orm";
import { deleteCharacterAction } from "@/app/admin/characters/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { CharacterDetailAutoRefresh } from "@/components/admin/character-detail-auto-refresh";
import { CharacterGallery } from "@/components/admin/character-gallery";
import { CharacterProfileSection } from "@/components/admin/character-profile-section";
import { CharacterRegenerateControls } from "@/components/admin/character-regenerate-controls";

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
  const isGenerating = item.status === "generating";
  const profileForEdit = latestProfile
    ? {
        approxAge: latestProfile.approxAge,
        hairColor: latestProfile.hairColor,
        hairLength: latestProfile.hairLength,
        hairTexture: latestProfile.hairTexture,
        hairStyle: latestProfile.hairStyle,
        faceShape: latestProfile.faceShape,
        eyeColor: latestProfile.eyeColor,
        eyeShape: latestProfile.eyeShape,
        skinTone: latestProfile.skinTone,
        clothing: latestProfile.clothing,
        distinctiveFeatures: latestProfile.distinctiveFeatures,
        colorPalette: latestProfile.colorPalette
          ? JSON.parse(latestProfile.colorPalette).join(", ")
          : "",
        personalityTraits: latestProfile.personalityTraits
          ? JSON.parse(latestProfile.personalityTraits).join(", ")
          : "",
        doNotChange: latestProfile.doNotChange
          ? JSON.parse(latestProfile.doNotChange).join(", ")
          : "",
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{item.name}</h1>
          <Badge variant="secondary">{item.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{item.gender}</p>
      </div>

      {isGenerating ? <CharacterDetailAutoRefresh /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <CharacterRegenerateControls characterId={id} />
        <form
          action={async () => {
            "use server";
            await deleteCharacterAction(id);
          }}
        >
          <Button type="submit" variant="destructive">
            Delete
          </Button>
        </form>
      </div>

      {isGenerating ? (
        <Card>
          <CardHeader>
            <CardTitle>Generation in progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              We are generating the character profile and illustration. This
              page will refresh automatically.
            </p>
            <Progress value={60} />
          </CardContent>
        </Card>
      ) : null}

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
          {item.sourceImageUrl ? (
            <div className="relative mt-3 h-48 w-40 overflow-hidden rounded-md border">
              <Image
                src={item.sourceImageUrl}
                alt={`${item.name} source`}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Separator />

      <CharacterProfileSection characterId={id} profile={profileForEdit} />

      <Card>
        <CardHeader>
          <CardTitle>Generated images</CardTitle>
        </CardHeader>
        <CardContent>
          <CharacterGallery
            characterId={id}
            images={images.map((image) => ({
              id: image.id,
              imageUrl: image.imageUrl,
              isSelected: image.isSelected,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
