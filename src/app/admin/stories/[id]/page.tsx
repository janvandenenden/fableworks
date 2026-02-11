import { and, asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, schema } from "@/db";
import {
  generateScenesAction,
  regenerateConceptAction,
} from "@/app/admin/stories/actions";
import { StoryDeleteButton } from "@/components/admin/story-delete-button";
import { StoryDetailAutoRefresh } from "@/components/admin/story-detail-auto-refresh";
import { StoryEditor } from "@/components/admin/story-editor";
import { StoryScenesEditor } from "@/components/admin/story-scenes-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  params: Promise<{ id: string }>;
};

type ArtifactPhase = "concept" | "manuscript" | "scenes";
type ArtifactRow = { structuredFields: string | null };

function getPhaseArtifact(artifacts: ArtifactRow[], phase: ArtifactPhase) {
  return artifacts.find((artifact) => {
    if (!artifact.structuredFields) return false;
    try {
      const payload = JSON.parse(artifact.structuredFields) as { phase?: string };
      return payload.phase === phase;
    } catch {
      return false;
    }
  });
}

export default async function StoryDetailPage({ params }: Props) {
  const { id } = await params;

  const storyRows = await db
    .select()
    .from(schema.stories)
    .where(eq(schema.stories.id, id))
    .limit(1);
  const story = storyRows[0];
  if (!story) {
    notFound();
  }

  const scenes = await db
    .select()
    .from(schema.storyScenes)
    .where(eq(schema.storyScenes.storyId, id))
    .orderBy(asc(schema.storyScenes.sceneNumber));
  const propsBible = await db
    .select({
      title: schema.propsBibleEntries.title,
      appearsInScenes: schema.propsBibleEntries.appearsInScenes,
    })
    .from(schema.propsBibleEntries)
    .where(eq(schema.propsBibleEntries.storyId, id));
  const characters = await db
    .select({
      id: schema.characters.id,
      name: schema.characters.name,
      status: schema.characters.status,
    })
    .from(schema.characters)
    .orderBy(desc(schema.characters.createdAt));
  const selectedCharacterImageRows = story.characterId
    ? await db
        .select({ imageUrl: schema.characterImages.imageUrl })
        .from(schema.characterImages)
        .where(
          and(
            eq(schema.characterImages.characterId, story.characterId),
            eq(schema.characterImages.isSelected, true)
          )
        )
        .limit(1)
    : [];
  const selectedCharacterImageUrl = selectedCharacterImageRows[0]?.imageUrl ?? null;
  const artifacts = await db
    .select()
    .from(schema.promptArtifacts)
    .where(eq(schema.promptArtifacts.entityId, id))
    .orderBy(desc(schema.promptArtifacts.createdAt))
    .limit(30);

  const conceptArtifact = getPhaseArtifact(artifacts, "concept");
  const manuscriptArtifact = getPhaseArtifact(artifacts, "manuscript");
  const scenesArtifact = getPhaseArtifact(artifacts, "scenes");

  const conceptData = (() => {
    if (!conceptArtifact?.structuredFields) return null;
    try {
      return (JSON.parse(conceptArtifact.structuredFields) as { concept?: Record<string, string> })
        .concept;
    } catch {
      return null;
    }
  })();

  const manuscriptData = (() => {
    if (!manuscriptArtifact?.structuredFields) return null;
    try {
      return (
        JSON.parse(manuscriptArtifact.structuredFields) as {
          manuscript?: { title?: string; arcSummary?: string };
        }
      ).manuscript;
    } catch {
      return null;
    }
  })();

  const isGenerating = story.status.includes("generating");
  const hasConcept = !!conceptData;
  const hasManuscript =
    !!manuscriptData || !!story.title?.trim() || !!story.storyArc?.trim();
  const hasScenes = scenes.length > 0;
  const hasStoryboard = story.status.includes("storyboard") || story.status.includes("pages");
  const propsByScene = propsBible.reduce<Record<number, string[]>>(
    (acc, prop) => {
      if (!prop.appearsInScenes) return acc;
      let sceneNumbers: number[] = [];
      try {
        sceneNumbers = JSON.parse(prop.appearsInScenes) as number[];
      } catch {
        sceneNumbers = [];
      }
      for (const sceneNumber of sceneNumbers) {
        const existing = acc[sceneNumber] ?? [];
        acc[sceneNumber] = [...existing, prop.title];
      }
      return acc;
    },
    {}
  );
  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">
            {story.title?.trim() || manuscriptData?.title || "Untitled story"}
          </h1>
          <Badge variant="secondary">{story.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Age {story.ageRange ?? "n/a"}
          {story.theme ? ` · ${story.theme}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {hasScenes ? (
            <Button asChild variant="outline">
              <Link href={`/admin/stories/${id}/props`}>Open Props Bible</Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Open Props Bible
            </Button>
          )}
          {hasScenes ? (
            <Button asChild variant="outline">
              <Link href={`/admin/stories/${id}/storyboard`}>
                Open Storyboard
              </Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Open Storyboard
            </Button>
          )}
          {hasStoryboard ? (
            <Button asChild variant="outline">
              <Link href={`/admin/stories/${id}/pages`}>Open Final Pages</Link>
            </Button>
          ) : (
            <Button variant="outline" disabled>
              Open Final Pages
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href={`/admin/books/${id}`}>Open Fulfillment</Link>
          </Button>
          <StoryDeleteButton storyId={id} />
        </div>
      </div>

      {isGenerating ? <StoryDetailAutoRefresh /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Concept</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {conceptData ? (
            <div className="space-y-1 text-sm">
              <p><strong>Emotional core:</strong> {conceptData.emotionalCore}</p>
              <p><strong>Visual hook:</strong> {conceptData.visualHook}</p>
              <p><strong>Tone:</strong> {conceptData.toneTexture}</p>
              <p><strong>Lesson thread:</strong> {conceptData.lessonThread}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No concept yet.</p>
          )}
          <form action={regenerateConceptAction}>
            <input type="hidden" name="storyId" value={id} />
            <Button type="submit" variant={hasConcept ? "outline" : "default"}>
              {hasConcept ? "Regenerate Concept" : "Generate Concept"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <StoryEditor
        story={{
          id: story.id,
          title: story.title ?? manuscriptData?.title ?? null,
          storyArc: story.storyArc ?? manuscriptData?.arcSummary ?? null,
          characterId: story.characterId ?? null,
        }}
        characters={characters}
        selectedCharacterImageUrl={selectedCharacterImageUrl}
        canGenerateManuscript={hasConcept}
        canRegenerateManuscript={hasManuscript}
      />

      {!hasScenes ? (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Scenes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No scenes generated yet.
            </p>
            <form action={generateScenesAction}>
              <input type="hidden" name="storyId" value={id} />
              <Button type="submit" disabled={!hasManuscript}>
                Generate Scenes
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {hasScenes ? (
        <>
          <div>
            <h2 className="text-xl font-semibold">Step 3: Scenes</h2>
            <p className="text-sm text-muted-foreground">
              Edit scenes inline and manage scene-linked props directly in each card.
            </p>
          </div>
          <StoryScenesEditor
            storyId={story.id}
            scenes={scenes.map((scene) => ({
              id: scene.id,
              sceneNumber: scene.sceneNumber,
              spreadText: scene.spreadText,
              sceneDescription: scene.sceneDescription,
            }))}
            propsByScene={propsByScene}
          />
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Latest prompt artifacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {artifacts.length === 0 ? (
            <p className="text-muted-foreground">No artifacts yet.</p>
          ) : (
            artifacts.slice(0, 8).map((artifact) => (
              <div key={artifact.id} className="rounded-md border px-3 py-2 text-muted-foreground">
                <p>
                  {artifact.status} · {artifact.model ?? "model-unknown"}
                </p>
                {artifact.errorMessage ? (
                  <p className="text-destructive">{artifact.errorMessage}</p>
                ) : null}
              </div>
            ))
          )}
          {scenesArtifact?.structuredFields ? (
            <p className="text-xs text-muted-foreground">Scenes artifact saved.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
