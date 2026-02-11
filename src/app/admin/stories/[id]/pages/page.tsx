import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { generateFinalPagesAction } from "@/app/admin/stories/[id]/pages/actions";
import { FinalPagesView } from "@/components/admin/final-pages-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildFinalPagePrompt } from "@/lib/prompts/final-page";

function parseSceneNumbers(value: string | null): number[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0);
  } catch {
    return [];
  }
}

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item));
  } catch {
    return [];
  }
}

function normalizeDateInput(
  value: Date | string | number | null | undefined
): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    const dateFromNumber = new Date(ms);
    return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber;
  }
  if (/^\d+$/.test(value)) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      const ms = asNumber < 10_000_000_000 ? asNumber * 1000 : asNumber;
      const dateFromDigits = new Date(ms);
      if (!Number.isNaN(dateFromDigits.getTime())) return dateFromDigits;
    }
  }
  const normalized =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
      ? value.replace(" ", "T") + "Z"
      : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toSafeIsoString(value: Date | string | number | null | undefined): string | null {
  const date = normalizeDateInput(value);
  return date ? date.toISOString() : null;
}

function toSafeTimestamp(value: Date | string | number | null | undefined): number | null {
  const date = normalizeDateInput(value);
  return date ? date.getTime() : null;
}

export default async function FinalPagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const storyRows = await db
    .select()
    .from(schema.stories)
    .where(eq(schema.stories.id, id))
    .limit(1);
  const story = storyRows[0];
  if (!story) notFound();

  const scenes = await db
    .select()
    .from(schema.storyScenes)
    .where(eq(schema.storyScenes.storyId, id))
    .orderBy(asc(schema.storyScenes.sceneNumber));

  const sceneIds = scenes.map((scene) => scene.id);
  const panels =
    sceneIds.length > 0
      ? await db
          .select()
          .from(schema.storyboardPanels)
          .where(inArray(schema.storyboardPanels.sceneId, sceneIds))
      : [];
  const panelBySceneId = new Map(panels.map((panel) => [panel.sceneId, panel]));

  const props = await db
    .select({
      title: schema.propsBibleEntries.title,
      description: schema.propsBibleEntries.description,
      appearsInScenes: schema.propsBibleEntries.appearsInScenes,
    })
    .from(schema.propsBibleEntries)
    .where(eq(schema.propsBibleEntries.storyId, id));

  const finalPages =
    sceneIds.length > 0
      ? await db
          .select()
          .from(schema.finalPages)
          .where(inArray(schema.finalPages.sceneId, sceneIds))
      : [];
  const finalPagesBySceneId = finalPages.reduce<
    Map<
      string,
      Array<{
        id: string;
        version: number | null;
        imageUrl: string;
        isApproved: boolean | null;
        createdAt: Date | null;
      }>
    >
  >((acc, page) => {
    const current = acc.get(page.sceneId) ?? [];
    current.push({
      id: page.id,
      version: page.version,
      imageUrl: page.imageUrl,
      isApproved: page.isApproved,
      createdAt: page.createdAt,
    });
    acc.set(page.sceneId, current);
    return acc;
  }, new Map());

  const promptArtifacts =
    sceneIds.length > 0
      ? await db
          .select({
            id: schema.promptArtifacts.id,
            entityId: schema.promptArtifacts.entityId,
            status: schema.promptArtifacts.status,
            errorMessage: schema.promptArtifacts.errorMessage,
            rawPrompt: schema.promptArtifacts.rawPrompt,
            parameters: schema.promptArtifacts.parameters,
            resultUrl: schema.promptArtifacts.resultUrl,
            createdAt: schema.promptArtifacts.createdAt,
            entityType: schema.promptArtifacts.entityType,
          })
          .from(schema.promptArtifacts)
          .where(
            and(
              inArray(schema.promptArtifacts.entityId, sceneIds),
              inArray(schema.promptArtifacts.entityType, [
                "final_page_image",
                "final_page_prompt_draft",
              ])
            )
          )
      : [];

  const runHistoryBySceneId = new Map<
    string,
    Array<{
      id: string;
      status: string | null;
      errorMessage: string | null;
      rawPrompt: string;
      parameters: unknown;
      resultUrl: string | null;
      createdAt: Date | string | null;
    }>
  >();
  const latestPromptDraftBySceneId = new Map<string, { rawPrompt: string; createdAt: Date | null }>();

  for (const artifact of promptArtifacts) {
    if (artifact.entityType === "final_page_image") {
      const currentRuns = runHistoryBySceneId.get(artifact.entityId) ?? [];
      currentRuns.push({
        id: artifact.id,
        status: artifact.status,
        errorMessage: artifact.errorMessage,
        rawPrompt: artifact.rawPrompt,
        parameters: artifact.parameters,
        resultUrl: artifact.resultUrl,
        createdAt: artifact.createdAt,
      });
      runHistoryBySceneId.set(artifact.entityId, currentRuns);
    }
    if (artifact.entityType === "final_page_prompt_draft") {
      const existing = latestPromptDraftBySceneId.get(artifact.entityId);
      if (
        !existing ||
        (artifact.createdAt && (!existing.createdAt || artifact.createdAt > existing.createdAt))
      ) {
        latestPromptDraftBySceneId.set(artifact.entityId, {
          rawPrompt: artifact.rawPrompt,
          createdAt: artifact.createdAt,
        });
      }
    }
  }

  const selectedImageRows =
    story.characterId
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
  const selectedCharacterImageUrl = selectedImageRows[0]?.imageUrl ?? null;
  const characterRows =
    story.characterId
      ? await db
          .select({ stylePreset: schema.characters.stylePreset })
          .from(schema.characters)
          .where(eq(schema.characters.id, story.characterId))
          .limit(1)
      : [];
  const characterStylePreset = characterRows[0]?.stylePreset ?? null;

  const profileRows =
    story.characterId
      ? await db
          .select({
            colorPalette: schema.characterProfiles.colorPalette,
            doNotChange: schema.characterProfiles.doNotChange,
            clothing: schema.characterProfiles.clothing,
            distinctiveFeatures: schema.characterProfiles.distinctiveFeatures,
          })
          .from(schema.characterProfiles)
          .where(eq(schema.characterProfiles.characterId, story.characterId))
          .limit(1)
      : [];
  const profile = profileRows[0];
  const colorPalette = parseStringArray(profile?.colorPalette ?? null);
  const doNotChange = parseStringArray(profile?.doNotChange ?? null);

  const sceneViewData = scenes.map((scene) => {
    const panel = panelBySceneId.get(scene.id);
    const versions = finalPagesBySceneId.get(scene.id) ?? [];
    const latestVersion = versions
      .slice()
      .sort((a, b) => (toSafeTimestamp(b.createdAt) ?? 0) - (toSafeTimestamp(a.createdAt) ?? 0))[0];
    const linkedProps = props
      .filter((prop) => parseSceneNumbers(prop.appearsInScenes).includes(scene.sceneNumber))
      .map((prop) => ({
        title: prop.title,
        description: prop.description,
      }));

    const generatedPrompt = buildFinalPagePrompt({
      sceneNumber: scene.sceneNumber,
      spreadText: scene.spreadText,
      sceneDescription: scene.sceneDescription,
      storyboardComposition: panel?.composition,
      storyboardBackground: panel?.background,
      storyboardForeground: panel?.foreground,
      storyboardEnvironment: panel?.environment,
      storyboardCharacterPose: panel?.characterPose,
      stylePreset: characterStylePreset,
      colorPalette,
      characterProfileSummary: [
        profile?.clothing ? `clothing: ${profile.clothing}` : null,
        profile?.distinctiveFeatures
          ? `features: ${profile.distinctiveFeatures}`
          : null,
      ]
        .filter(Boolean)
        .join("; "),
      doNotChange,
      linkedProps,
      characterReferenceUrl: selectedCharacterImageUrl,
      storyboardReferenceUrl: panel?.imageUrl ?? null,
    });

    const draftPrompt = latestPromptDraftBySceneId.get(scene.id)?.rawPrompt?.trim();
    const runHistory = (runHistoryBySceneId.get(scene.id) ?? [])
      .slice()
      .sort((a, b) => (toSafeTimestamp(b.createdAt) ?? 0) - (toSafeTimestamp(a.createdAt) ?? 0))
      .slice(0, 10)
      .map((run) => ({
        id: run.id,
        status: run.status ?? null,
        errorMessage: run.errorMessage ?? null,
        rawPrompt: run.rawPrompt,
        parameters: (() => {
          if (!run.parameters) return null;
          if (typeof run.parameters === "string") return run.parameters;
          try {
            return JSON.stringify(run.parameters, null, 2);
          } catch {
            return null;
          }
        })(),
        resultUrl: run.resultUrl ?? null,
        createdAt: toSafeIsoString(run.createdAt),
      }));

    return {
      storyId: id,
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      spreadText: scene.spreadText,
      sceneDescription: scene.sceneDescription,
      storyboardImageUrl: panel?.imageUrl ?? null,
      latestImageUrl: latestVersion?.imageUrl ?? null,
      latestVersion: latestVersion?.version ?? null,
      latestApproved: Boolean(latestVersion?.isApproved),
      promptPreview: draftPrompt || generatedPrompt,
      runHistory,
      versions: versions.map((page) => ({
        id: page.id,
        version: page.version ?? 1,
        imageUrl: page.imageUrl,
        isApproved: Boolean(page.isApproved),
      })),
    };
  });

  const missingScenes = scenes.length === 0;
  const missingStoryboard = sceneViewData.some((scene) => !scene.storyboardImageUrl);
  const missingCharacterLink = !story.characterId;
  const missingSelectedCharacter = !selectedCharacterImageUrl;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Final Pages</h1>
        <p className="text-sm text-muted-foreground">
          {story.title?.trim() || "Untitled story"} · {story.status}
        </p>
      </div>

      {(missingScenes || missingStoryboard || missingCharacterLink || missingSelectedCharacter) ? (
        <Card>
          <CardHeader>
            <CardTitle>Prerequisites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {missingScenes ? <p>- Generate scenes first.</p> : null}
            {missingStoryboard ? <p>- Generate all storyboard panel images first.</p> : null}
            {missingCharacterLink ? <p>- Link this story to a character first.</p> : null}
            {missingSelectedCharacter ? <p>- Select a character image variant first.</p> : null}
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/stories/${id}`}>Back to Story</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/stories/${id}/storyboard`}>Open Storyboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Generate Final Pages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Generate missing pages in bulk, then review and regenerate per scene.
            </p>
            <form action={generateFinalPagesAction}>
              <input type="hidden" name="storyId" value={id} />
              <Button type="submit">Generate Final Pages</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <FinalPagesView scenes={sceneViewData} />
    </div>
  );
}
