import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import {
  generateStoryboardCompositionsAction,
  generateStoryboardImagesAction,
} from "@/app/admin/stories/[id]/storyboard/actions";
import {
  buildStoryboardPanelPrompt,
  getStoryboardOutlineReferenceUrl,
  STORYBOARD_ASPECT_RATIO,
} from "@/lib/prompts/storyboard";
import { buildStoryCoverPrompt } from "@/lib/prompts/cover";
import { StoryboardView } from "@/components/admin/storyboard-view";
import { StoryboardCoverCard } from "@/components/admin/storyboard-cover-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      if (!Number.isNaN(dateFromDigits.getTime())) {
        return dateFromDigits;
      }
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
  if (!date) return null;
  return date.toISOString();
}

function toSafeTimestamp(value: Date | string | number | null | undefined): number | null {
  const date = normalizeDateInput(value);
  return date ? date.getTime() : null;
}

export default async function StoryboardPage({
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

  const props = await db
    .select({
      title: schema.propsBibleEntries.title,
      description: schema.propsBibleEntries.description,
      appearsInScenes: schema.propsBibleEntries.appearsInScenes,
    })
    .from(schema.propsBibleEntries)
    .where(eq(schema.propsBibleEntries.storyId, id));

  const sceneIds = scenes.map((scene) => scene.id);
  const panels =
    sceneIds.length > 0
      ? await db
          .select()
          .from(schema.storyboardPanels)
          .where(inArray(schema.storyboardPanels.sceneId, sceneIds))
      : [];

  const panelBySceneId = new Map(panels.map((panel) => [panel.sceneId, panel]));
  const panelIds = panels.map((panel) => panel.id);
  const panelAssets =
    panelIds.length > 0
      ? await db
          .select({
            id: schema.generatedAssets.id,
            entityId: schema.generatedAssets.entityId,
            storageUrl: schema.generatedAssets.storageUrl,
            createdAt: schema.generatedAssets.createdAt,
            type: schema.generatedAssets.type,
          })
          .from(schema.generatedAssets)
          .where(inArray(schema.generatedAssets.entityId, panelIds))
      : [];
  const panelAssetVersionsByPanelId = new Map<
    string,
    Array<{
      id: string;
      storageUrl: string;
      createdAt: Date | null;
    }>
  >();
  for (const asset of panelAssets) {
    if (asset.type !== "storyboard_panel") continue;
    const current = panelAssetVersionsByPanelId.get(asset.entityId ?? "") ?? [];
    current.push({
      id: asset.id,
      storageUrl: asset.storageUrl,
      createdAt: asset.createdAt,
    });
    if (asset.entityId) {
      panelAssetVersionsByPanelId.set(asset.entityId, current);
    }
  }
  const promptArtifacts =
    panelIds.length > 0
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
          })
          .from(schema.promptArtifacts)
          .where(
            and(
              inArray(schema.promptArtifacts.entityId, panelIds),
              eq(schema.promptArtifacts.entityType, "storyboard_panel_image")
            )
          )
      : [];
  const promptDraftArtifacts =
    panelIds.length > 0
      ? await db
          .select({
            entityId: schema.promptArtifacts.entityId,
            rawPrompt: schema.promptArtifacts.rawPrompt,
            createdAt: schema.promptArtifacts.createdAt,
          })
          .from(schema.promptArtifacts)
          .where(
            and(
              inArray(schema.promptArtifacts.entityId, panelIds),
              eq(schema.promptArtifacts.entityType, "storyboard_panel_prompt_draft")
            )
          )
      : [];
  const latestPromptArtifactByPanelId = new Map<
    string,
    {
      status: string | null;
      errorMessage: string | null;
      createdAt: Date | null;
    }
  >();
  const runHistoryByPanelId = new Map<
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
  for (const artifact of promptArtifacts) {
    const currentRuns = runHistoryByPanelId.get(artifact.entityId) ?? [];
    currentRuns.push({
      id: artifact.id,
      status: artifact.status,
      errorMessage: artifact.errorMessage,
      rawPrompt: artifact.rawPrompt,
      parameters: artifact.parameters,
      resultUrl: artifact.resultUrl,
      createdAt: artifact.createdAt,
    });
    runHistoryByPanelId.set(artifact.entityId, currentRuns);

    const existing = latestPromptArtifactByPanelId.get(artifact.entityId);
    if (
      !existing ||
      (artifact.createdAt && (!existing.createdAt || artifact.createdAt > existing.createdAt))
    ) {
      latestPromptArtifactByPanelId.set(artifact.entityId, {
        status: artifact.status,
        errorMessage: artifact.errorMessage,
        createdAt: artifact.createdAt,
      });
    }
  }
  const latestPromptDraftByPanelId = new Map<
    string,
    {
      rawPrompt: string;
      createdAt: Date | null;
    }
  >();
  for (const artifact of promptDraftArtifacts) {
    const existing = latestPromptDraftByPanelId.get(artifact.entityId);
    if (
      !existing ||
      (artifact.createdAt && (!existing.createdAt || artifact.createdAt > existing.createdAt))
    ) {
      latestPromptDraftByPanelId.set(artifact.entityId, {
        rawPrompt: artifact.rawPrompt,
        createdAt: artifact.createdAt,
      });
    }
  }
  const outlineReferenceUrl = getStoryboardOutlineReferenceUrl();

  const coverAssets = await db
    .select()
    .from(schema.generatedAssets)
    .where(eq(schema.generatedAssets.entityId, id))
    .orderBy(asc(schema.generatedAssets.createdAt));
  const latestCover = [...coverAssets]
    .reverse()
    .find((asset) => asset.type === "story_cover") ?? null;

  const coverRuns = await db
    .select({
      id: schema.promptArtifacts.id,
      status: schema.promptArtifacts.status,
      errorMessage: schema.promptArtifacts.errorMessage,
      rawPrompt: schema.promptArtifacts.rawPrompt,
      parameters: schema.promptArtifacts.parameters,
      resultUrl: schema.promptArtifacts.resultUrl,
      createdAt: schema.promptArtifacts.createdAt,
      entityType: schema.promptArtifacts.entityType,
    })
    .from(schema.promptArtifacts)
    .where(eq(schema.promptArtifacts.entityId, id));

  const coverPromptDraft = [...coverRuns]
    .reverse()
    .find((run) => run.entityType === "storyboard_cover_prompt_draft");
  const coverRunHistory = coverRuns
    .filter((run) => run.entityType === "storyboard_cover_image")
    .sort((a, b) => (toSafeTimestamp(b.createdAt) ?? 0) - (toSafeTimestamp(a.createdAt) ?? 0))
    .slice(0, 10)
    .map((run) => ({
      id: run.id,
      status: run.status ?? null,
      errorMessage: run.errorMessage ?? null,
      rawPrompt: run.rawPrompt,
      parameters:
        run.parameters && typeof run.parameters !== "string"
          ? JSON.stringify(run.parameters, null, 2)
          : typeof run.parameters === "string"
            ? run.parameters
            : null,
      resultUrl: run.resultUrl ?? null,
      createdAt: toSafeIsoString(run.createdAt),
    }));

  const coverSceneSummary = scenes
    .slice(0, 6)
    .map((scene) => scene.sceneDescription ?? scene.spreadText ?? "")
    .filter(Boolean)
    .join(" | ");
  const coverPropsSummary = props.map((prop) => prop.title).slice(0, 8).join(", ");
  const generatedCoverPrompt = buildStoryCoverPrompt({
    title: story.title,
    storyArc: story.storyArc,
    sceneSummary: coverSceneSummary,
    propsSummary: coverPropsSummary,
    outlineReferenceUrl,
  });
  const coverPromptPreview =
    coverPromptDraft?.rawPrompt?.trim() || generatedCoverPrompt;

  const panelViewData = scenes.map((scene) => {
    const panel = panelBySceneId.get(scene.id);
    const latestPromptArtifact = panel
      ? latestPromptArtifactByPanelId.get(panel.id)
      : undefined;
    const latestPromptDraft = panel ? latestPromptDraftByPanelId.get(panel.id) : undefined;
    const panelRunHistory = panel ? runHistoryByPanelId.get(panel.id) ?? [] : [];
    const runHistory = panelRunHistory
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
    const linkedProps = props.filter((prop) =>
      parseSceneNumbers(prop.appearsInScenes).includes(scene.sceneNumber)
    );
    const promptPreview = buildStoryboardPanelPrompt({
      sceneNumber: scene.sceneNumber,
      background: panel?.background ?? "",
      foreground: panel?.foreground ?? "",
      environment: panel?.environment ?? "",
      characterPose: panel?.characterPose ?? "",
      composition: panel?.composition ?? "",
      linkedProps,
      outlineReferenceUrl,
    });
    const draftPrompt = latestPromptDraft?.rawPrompt?.trim();

    return {
      id: panel?.id ?? `missing-${scene.id}`,
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      spreadText: scene.spreadText,
      sceneDescription: scene.sceneDescription,
      background: panel?.background ?? "",
      foreground: panel?.foreground ?? "",
      environment: panel?.environment ?? "",
      characterPose: panel?.characterPose ?? "",
      composition: panel?.composition ?? "",
      propsUsed: panel?.propsUsed ?? null,
      imageUrl: panel?.imageUrl ?? null,
      status: panel?.status ?? "pending",
      lastRunStatus: latestPromptArtifact?.status ?? null,
      lastRunError: latestPromptArtifact?.errorMessage ?? null,
      lastRunAt: toSafeIsoString(latestPromptArtifact?.createdAt),
      promptPreview: draftPrompt || promptPreview,
      linkedPropsText: linkedProps.map((prop) => prop.title).join(", "),
      storyId: id,
      outlineReferenceUrl,
      aspectRatio: STORYBOARD_ASPECT_RATIO,
      runHistory,
      versions: (panel ? panelAssetVersionsByPanelId.get(panel.id) ?? [] : [])
        .slice()
        .sort((a, b) => (toSafeTimestamp(b.createdAt) ?? 0) - (toSafeTimestamp(a.createdAt) ?? 0))
        .map((version, index) => ({
          id: version.id,
          storageUrl: version.storageUrl,
          label: `v${index + 1}`,
          isActive: version.storageUrl === (panel?.imageUrl ?? null),
          createdAt: toSafeIsoString(version.createdAt),
        })),
    };
  });

  const hasProps = props.length > 0;
  const hasCompositions = panels.length > 0;
  const hasAllPanels = panels.length === scenes.length && scenes.length > 0;
  const canGenerateStoryboard = hasProps && scenes.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Storyboard</h1>
          <p className="text-sm text-muted-foreground">
            {story.title?.trim() || "Untitled story"} · {story.status}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/stories/${id}`}>Back to story</Link>
        </Button>
      </div>

      {!hasProps ? (
        <Card>
          <CardHeader>
            <CardTitle>Props bible required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Storyboard generation is blocked until props bible is ready.
            </p>
            <Button asChild>
              <Link href={`/admin/stories/${id}/props`}>Open Props Bible</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <StoryboardCoverCard
        storyId={id}
        imageUrl={latestCover?.storageUrl ?? null}
        promptPreview={coverPromptPreview}
        outlineReferenceUrl={outlineReferenceUrl}
        aspectRatio={STORYBOARD_ASPECT_RATIO}
        runHistory={coverRunHistory}
      />

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Generate Compositions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Generate composition fields for all scenes (1 scene = 1 panel).
          </p>
          <form action={generateStoryboardCompositionsAction}>
            <input type="hidden" name="storyId" value={id} />
            <Button type="submit" disabled={!canGenerateStoryboard}>
              {hasCompositions ? "Regenerate All Compositions" : "Generate All Compositions"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Generate Storyboard Images</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Generate black-and-white sketch panels. Aspect ratio is set in model input.
          </p>
          <form action={generateStoryboardImagesAction}>
            <input type="hidden" name="storyId" value={id} />
            <Button type="submit" disabled={!hasAllPanels}>
              Generate All Panel Images
            </Button>
          </form>
          {!hasAllPanels ? (
            <p className="text-xs text-muted-foreground">
              Generate compositions first for every scene.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold">Panels</h2>
        <p className="text-sm text-muted-foreground">
          Each panel shows the exact prompt before generation and supports one-by-one testing.
        </p>
      </div>

      <StoryboardView
        panels={panelViewData.filter((panel) => !panel.id.startsWith("missing-"))}
      />
    </div>
  );
}
