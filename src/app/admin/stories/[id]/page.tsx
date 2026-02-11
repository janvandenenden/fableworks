import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { db, schema } from "@/db";
import { buildStoryCoverPrompt, getOutlineReferenceUrl } from "@/lib/prompts/cover";
import {
  deleteStoryAction,
  generateManuscriptAction,
  generateStoryCoverAction,
  generateScenesAction,
  regenerateConceptAction,
} from "@/app/admin/stories/actions";
import { StoryDetailAutoRefresh } from "@/components/admin/story-detail-auto-refresh";
import { StoryEditor } from "@/components/admin/story-editor";
import { StoryScenesEditor } from "@/components/admin/story-scenes-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

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
  const coverAssets = await db
    .select()
    .from(schema.generatedAssets)
    .where(eq(schema.generatedAssets.entityId, id))
    .orderBy(desc(schema.generatedAssets.createdAt))
    .limit(5);
  const latestCover = coverAssets.find((asset) => asset.type === "story_cover") ?? null;

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
  const coverSceneSummary = scenes
    .slice(0, 6)
    .map((scene) => scene.sceneDescription ?? scene.spreadText ?? "")
    .filter(Boolean)
    .join(" | ");
  const coverPropsSummary = propsBible.map((prop) => prop.title).slice(0, 8).join(", ");
  const previewCoverPrompt = buildStoryCoverPrompt({
    title: story.title,
    storyArc: story.storyArc,
    sceneSummary: coverSceneSummary,
    propsSummary: coverPropsSummary,
    outlineReferenceUrl: getOutlineReferenceUrl(),
  });

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
          <form action={deleteStoryAction}>
            <input type="hidden" name="storyId" value={id} />
            <Button type="submit" variant="destructive">
              Delete Story
            </Button>
          </form>
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

      {hasManuscript ? (
        <StoryEditor
          story={{
            id: story.id,
            title: story.title ?? manuscriptData?.title ?? null,
            storyArc: story.storyArc ?? manuscriptData?.arcSummary ?? null,
          }}
          canRegenerateManuscript
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Manuscript Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">No manuscript metadata yet.</p>
            <form action={generateManuscriptAction}>
              <input type="hidden" name="storyId" value={id} />
              <Button type="submit" disabled={!hasConcept}>
                Generate Manuscript Metadata
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

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
          <Card>
            <CardHeader>
              <CardTitle>Draft Cover</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestCover ? (
                <div className="relative h-[420px] w-[280px] overflow-hidden rounded-md border">
                  <Image
                    src={latestCover.storageUrl}
                    alt="Story cover draft"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No cover generated yet.
                </p>
              )}
              <form action={generateStoryCoverAction}>
                <input type="hidden" name="storyId" value={id} />
                <div className="mb-3 grid gap-1">
                  <label
                    htmlFor="coverPrompt"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Exact prompt sent to NanoBanana Pro
                  </label>
                  <Textarea
                    id="coverPrompt"
                    name="coverPrompt"
                    defaultValue={previewCoverPrompt}
                    rows={8}
                    className="text-xs"
                  />
                </div>
                <Button type="submit" variant={latestCover ? "outline" : "default"}>
                  {latestCover ? "Regenerate Cover" : "Generate Cover"}
                </Button>
              </form>
            </CardContent>
          </Card>

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
