"use server";

import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { generateText } from "@/lib/openai";
import {
  MODELS,
  createPrediction,
  extractImageUrl,
  getReplicateClient,
} from "@/lib/replicate";
import { copyFromTempUrl, deleteFromR2PublicUrl } from "@/lib/r2";
import { buildStoryCoverPrompt } from "@/lib/prompts/cover";
import {
  buildStoryboardCompositionPrompt,
  buildStoryboardPanelPrompt,
  getStoryboardOutlineReferenceUrl,
  parseAndValidateStoryboardComposition,
  STORYBOARD_ASPECT_RATIO,
} from "@/lib/prompts/storyboard";
import { revalidatePath } from "next/cache";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const storyIdSchema = z.object({
  storyId: z.string().uuid(),
});

const panelImageSchema = z.object({
  storyId: z.string().uuid(),
  panelId: z.string().uuid(),
  promptOverride: z.string().optional(),
});
const panelImageFromRunSchema = z.object({
  storyId: z.string().uuid(),
  panelId: z.string().uuid(),
  runArtifactId: z.string().uuid(),
});
const panelPromptDraftSchema = z.object({
  storyId: z.string().uuid(),
  panelId: z.string().uuid(),
  promptOverride: z.string().min(1, "Prompt cannot be empty"),
});
const coverPromptDraftSchema = z.object({
  storyId: z.string().uuid(),
  promptOverride: z.string().min(1, "Prompt cannot be empty"),
});
const coverFromRunSchema = z.object({
  storyId: z.string().uuid(),
  runArtifactId: z.string().uuid(),
});
const panelVersionSchema = z.object({
  storyId: z.string().uuid(),
  panelId: z.string().uuid(),
  assetId: z.string().uuid(),
});

function newId(): string {
  return crypto.randomUUID();
}

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

function mapLinkedPropsForScene(
  sceneNumber: number,
  props: Array<{
    title: string;
    description: string;
    appearsInScenes: string | null;
  }>
) {
  return props.filter((prop) =>
    parseSceneNumbers(prop.appearsInScenes).includes(sceneNumber)
  );
}

function buildStoryboardImageRequestPayload(input: {
  prompt: string;
  outlineReferenceUrl: string;
}) {
  return {
    prompt: input.prompt,
    aspect_ratio: STORYBOARD_ASPECT_RATIO,
    output_format: "png",
    image: input.outlineReferenceUrl,
  };
}

function buildStoryboardCoverRequestPayload(input: {
  prompt: string;
  outlineReferenceUrl: string;
}) {
  return {
    prompt: input.prompt,
    aspect_ratio: STORYBOARD_ASPECT_RATIO,
    output_format: "png",
    image: input.outlineReferenceUrl,
  };
}

const storyboardImageRequestPayloadSchema = z.object({
  prompt: z.string().min(1),
  aspect_ratio: z.string().min(1),
  output_format: z.string().min(1),
  image: z.string().min(1),
});

const storyboardCoverRequestPayloadSchema = z.object({
  prompt: z.string().min(1),
  aspect_ratio: z.string().min(1),
  output_format: z.string().min(1),
  image: z.string().min(1),
});

export async function generateStoryboardCompositionsAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = storyIdSchema.parse({
    storyId: formData.get("storyId"),
  });

  const storyRows = await db
    .select()
    .from(schema.stories)
    .where(eq(schema.stories.id, payload.storyId))
    .limit(1);
  const story = storyRows[0];
  if (!story) return { success: false, error: "Story not found" };

  const scenes = await db
    .select()
    .from(schema.storyScenes)
    .where(eq(schema.storyScenes.storyId, payload.storyId))
    .orderBy(asc(schema.storyScenes.sceneNumber));
  if (scenes.length === 0) {
    return { success: false, error: "Generate scenes first" };
  }

  const props = await db
    .select({
      title: schema.propsBibleEntries.title,
      description: schema.propsBibleEntries.description,
      appearsInScenes: schema.propsBibleEntries.appearsInScenes,
    })
    .from(schema.propsBibleEntries)
    .where(eq(schema.propsBibleEntries.storyId, payload.storyId));

  if (props.length === 0) {
    return { success: false, error: "Generate props bible first" };
  }

  await db
    .update(schema.stories)
    .set({ status: "storyboard_generating_compositions" })
    .where(eq(schema.stories.id, payload.storyId));

  const sceneIds = scenes.map((scene) => scene.id);
  if (sceneIds.length > 0) {
    await db
      .delete(schema.storyboardPanels)
      .where(inArray(schema.storyboardPanels.sceneId, sceneIds));
  }

  try {
    for (const scene of scenes) {
      const linkedProps = mapLinkedPropsForScene(scene.sceneNumber, props);
      const prompts = buildStoryboardCompositionPrompt({
        sceneNumber: scene.sceneNumber,
        sceneDescription: scene.sceneDescription,
        linkedProps,
      });

      const raw = await generateText(
        [
          { role: "system", content: prompts.systemPrompt },
          { role: "user", content: prompts.userPrompt },
        ],
        {
          model: "gpt-4o",
          maxTokens: 1200,
          temperature: 0.4,
        }
      );

      const composition = parseAndValidateStoryboardComposition(raw);
      const panelId = newId();

      await db.insert(schema.storyboardPanels).values({
        id: panelId,
        sceneId: scene.id,
        background: composition.background,
        foreground: composition.foreground,
        environment: composition.environment,
        characterPose: composition.characterPose,
        composition: composition.composition,
        propsUsed: JSON.stringify(composition.propsUsed),
        status: "composed",
      });

      await db.insert(schema.promptArtifacts).values({
        id: newId(),
        entityType: "storyboard_panel_composition",
        entityId: panelId,
        rawPrompt: `${prompts.systemPrompt}\n\n${prompts.userPrompt}`,
        model: "gpt-4o",
        status: "success",
        createdAt: new Date(),
      });
    }

    await db
      .update(schema.stories)
      .set({ status: "storyboard_compositions_ready" })
      .where(eq(schema.stories.id, payload.storyId));

    revalidatePath(`/admin/stories/${payload.storyId}/storyboard`);
    revalidatePath(`/admin/stories/${payload.storyId}`);
    return { success: true, data: { id: payload.storyId } };
  } catch (error) {
    await db
      .update(schema.stories)
      .set({ status: "storyboard_failed" })
      .where(eq(schema.stories.id, payload.storyId));
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate storyboard compositions",
    };
  }
}

async function generateSinglePanelImage(input: {
  storyId: string;
  panelId: string;
  promptOverride?: string | null;
  requestPayloadOverride?: z.infer<typeof storyboardImageRequestPayloadSchema> | null;
}): Promise<ActionResult<{ id: string }>> {
  const panelRows = await db
    .select()
    .from(schema.storyboardPanels)
    .where(eq(schema.storyboardPanels.id, input.panelId))
    .limit(1);
  const panel = panelRows[0];
  if (!panel) return { success: false, error: "Storyboard panel not found" };

  const sceneRows = await db
    .select()
    .from(schema.storyScenes)
    .where(eq(schema.storyScenes.id, panel.sceneId))
    .limit(1);
  const scene = sceneRows[0];
  if (!scene) return { success: false, error: "Scene not found for panel" };

  const props = await db
    .select({
      title: schema.propsBibleEntries.title,
      description: schema.propsBibleEntries.description,
      appearsInScenes: schema.propsBibleEntries.appearsInScenes,
    })
    .from(schema.propsBibleEntries)
    .where(eq(schema.propsBibleEntries.storyId, input.storyId));

  const linkedProps = mapLinkedPropsForScene(scene.sceneNumber, props);
  const outlineReferenceUrl = getStoryboardOutlineReferenceUrl();
  const generatedPrompt = buildStoryboardPanelPrompt({
    sceneNumber: scene.sceneNumber,
    background: panel.background,
    foreground: panel.foreground,
    environment: panel.environment,
    characterPose: panel.characterPose,
    composition: panel.composition,
    linkedProps,
    outlineReferenceUrl,
  });
  const prompt = input.promptOverride?.trim() || generatedPrompt;
  const requestPayload = (() => {
    if (input.requestPayloadOverride) {
      return input.requestPayloadOverride;
    }
    if (!outlineReferenceUrl) {
      return null;
    }
    return buildStoryboardImageRequestPayload({
      prompt,
      outlineReferenceUrl,
    });
  })();
  if (!requestPayload) {
    return {
      success: false,
      error:
        "Outline reference image URL is required. Set OUTLINE_IMAGE_URL or NEXT_PUBLIC_APP_URL.",
    };
  }

  const promptId = newId();
  await db.insert(schema.promptArtifacts).values({
    id: promptId,
    entityType: "storyboard_panel_image",
    entityId: panel.id,
    rawPrompt: requestPayload.prompt,
    model: MODELS.nanoBananaPro,
    parameters: requestPayload,
    status: "running",
    createdAt: new Date(),
  });
  await db
    .update(schema.storyboardPanels)
    .set({
      status: "generating",
      promptArtifactId: promptId,
    })
    .where(eq(schema.storyboardPanels.id, panel.id));

  try {
    const prediction = await createPrediction(MODELS.nanoBananaPro, requestPayload);

    const replicate = getReplicateClient();
    let predictionOutput: unknown = null;
    let predictionStatus = prediction.status;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const result = await replicate.predictions.get(prediction.id);
      predictionStatus = result.status;
      if (result.status === "succeeded") {
        predictionOutput = result.output;
        break;
      }
      if (result.status === "failed" || result.status === "canceled") {
        throw new Error(
          `Replicate prediction ${result.status}: ${result.error ?? "unknown"}`
        );
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 5000);
      });
    }

    if (!predictionOutput) {
      throw new Error(`Replicate prediction still ${predictionStatus}`);
    }

    const tempUrl = extractImageUrl(predictionOutput);
    if (!tempUrl) {
      throw new Error("Replicate did not return an image URL for storyboard panel");
    }

    const storageUrl = await copyFromTempUrl(
      tempUrl,
      `stories/${input.storyId}/storyboard/${panel.id}.png`
    );

    await db.insert(schema.generatedAssets).values({
      id: newId(),
      type: "storyboard_panel",
      entityId: panel.id,
      storageUrl,
      mimeType: "image/png",
      metadata: JSON.stringify({ promptId }),
    });

    await db
      .update(schema.storyboardPanels)
      .set({
        imageUrl: storageUrl,
        promptArtifactId: promptId,
        status: "generated",
      })
      .where(eq(schema.storyboardPanels.id, panel.id));

    await db
      .update(schema.promptArtifacts)
      .set({ status: "success", resultUrl: storageUrl })
      .where(eq(schema.promptArtifacts.id, promptId));

    return { success: true, data: { id: panel.id } };
  } catch (error) {
    await db
      .update(schema.storyboardPanels)
      .set({
        status: "failed",
        promptArtifactId: promptId,
      })
      .where(eq(schema.storyboardPanels.id, panel.id));
    await db
      .update(schema.promptArtifacts)
      .set({
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Storyboard image generation failed",
      })
      .where(eq(schema.promptArtifacts.id, promptId));
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate storyboard panel image",
    };
  }
}

export async function generateStoryboardPanelImageAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = panelImageSchema.parse({
    storyId: formData.get("storyId"),
    panelId: formData.get("panelId"),
    promptOverride: formData.get("promptOverride"),
  });

  const result = await generateSinglePanelImage({
    storyId: payload.storyId,
    panelId: payload.panelId,
    promptOverride: payload.promptOverride ?? null,
  });
  revalidatePath(`/admin/stories/${payload.storyId}/storyboard`);
  return result;
}

function parseStoryboardRequestPayload(
  value: unknown
): z.infer<typeof storyboardImageRequestPayloadSchema> | null {
  if (!value) return null;
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  const result = storyboardImageRequestPayloadSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

function parseStoryboardCoverRequestPayload(
  value: unknown
): z.infer<typeof storyboardCoverRequestPayloadSchema> | null {
  if (!value) return null;
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  const result = storyboardCoverRequestPayloadSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

export async function generateStoryboardPanelImageFromRunAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = panelImageFromRunSchema.parse({
    storyId: formData.get("storyId"),
    panelId: formData.get("panelId"),
    runArtifactId: formData.get("runArtifactId"),
  });

  const artifactRows = await db
    .select()
    .from(schema.promptArtifacts)
    .where(eq(schema.promptArtifacts.id, payload.runArtifactId))
    .limit(1);
  const artifact = artifactRows[0];
  if (!artifact) return { success: false, error: "Run artifact not found" };
  if (artifact.entityType !== "storyboard_panel_image") {
    return { success: false, error: "Invalid run artifact type" };
  }
  if (artifact.entityId !== payload.panelId) {
    return { success: false, error: "Run artifact does not belong to this panel" };
  }

  const parsedPayload = parseStoryboardRequestPayload(artifact.parameters);
  if (!parsedPayload) {
    return { success: false, error: "Run artifact payload is missing or invalid" };
  }

  const result = await generateSinglePanelImage({
    storyId: payload.storyId,
    panelId: payload.panelId,
    requestPayloadOverride: parsedPayload,
  });

  revalidatePath(`/admin/stories/${payload.storyId}/storyboard`);
  return result;
}

async function generateStoryboardCover(input: {
  storyId: string;
  promptOverride?: string | null;
  requestPayloadOverride?: z.infer<typeof storyboardCoverRequestPayloadSchema> | null;
}): Promise<ActionResult<{ id: string }>> {
  const storyRows = await db
    .select()
    .from(schema.stories)
    .where(eq(schema.stories.id, input.storyId))
    .limit(1);
  const story = storyRows[0];
  if (!story) return { success: false, error: "Story not found" };

  const scenes = await db
    .select({
      sceneDescription: schema.storyScenes.sceneDescription,
      spreadText: schema.storyScenes.spreadText,
    })
    .from(schema.storyScenes)
    .where(eq(schema.storyScenes.storyId, input.storyId))
    .orderBy(asc(schema.storyScenes.sceneNumber));

  const props = await db
    .select({ title: schema.propsBibleEntries.title })
    .from(schema.propsBibleEntries)
    .where(eq(schema.propsBibleEntries.storyId, input.storyId));

  const sceneSummary = scenes
    .slice(0, 6)
    .map((scene) => scene.sceneDescription ?? scene.spreadText ?? "")
    .filter(Boolean)
    .join(" | ");
  const propsSummary = props.map((prop) => prop.title).slice(0, 8).join(", ");

  const outlineReferenceUrl = getStoryboardOutlineReferenceUrl();
  const generatedPrompt = buildStoryCoverPrompt({
    title: story.title,
    storyArc: story.storyArc,
    sceneSummary,
    propsSummary,
    outlineReferenceUrl,
  });
  const prompt = input.promptOverride?.trim() || generatedPrompt;

  const requestPayload = (() => {
    if (input.requestPayloadOverride) return input.requestPayloadOverride;
    if (!outlineReferenceUrl) return null;
    return buildStoryboardCoverRequestPayload({
      prompt,
      outlineReferenceUrl,
    });
  })();
  if (!requestPayload) {
    return {
      success: false,
      error:
        "Outline reference image URL is required. Set OUTLINE_IMAGE_URL or NEXT_PUBLIC_APP_URL.",
    };
  }

  const promptId = newId();
  await db.insert(schema.promptArtifacts).values({
    id: promptId,
    entityType: "storyboard_cover_image",
    entityId: input.storyId,
    rawPrompt: requestPayload.prompt,
    model: MODELS.nanoBananaPro,
    parameters: requestPayload,
    status: "running",
    createdAt: new Date(),
  });

  try {
    const prediction = await createPrediction(MODELS.nanoBananaPro, requestPayload);

    const replicate = getReplicateClient();
    let predictionOutput: unknown = null;
    let predictionStatus = prediction.status;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const result = await replicate.predictions.get(prediction.id);
      predictionStatus = result.status;
      if (result.status === "succeeded") {
        predictionOutput = result.output;
        break;
      }
      if (result.status === "failed" || result.status === "canceled") {
        throw new Error(
          `Replicate prediction ${result.status}: ${result.error ?? "unknown"}`
        );
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 5000);
      });
    }

    if (!predictionOutput) {
      throw new Error(`Replicate prediction still ${predictionStatus}`);
    }

    const tempUrl = extractImageUrl(predictionOutput);
    if (!tempUrl) {
      throw new Error("Replicate did not return an image URL for storyboard cover");
    }

    const assetId = newId();
    const storageUrl = await copyFromTempUrl(
      tempUrl,
      `stories/${input.storyId}/storyboard/cover/${assetId}.png`
    );

    await db.insert(schema.generatedAssets).values({
      id: assetId,
      type: "story_cover",
      entityId: input.storyId,
      storageUrl,
      mimeType: "image/png",
      metadata: JSON.stringify({ promptId }),
    });

    await db
      .update(schema.promptArtifacts)
      .set({ status: "success", resultUrl: storageUrl })
      .where(eq(schema.promptArtifacts.id, promptId));

    return { success: true, data: { id: input.storyId } };
  } catch (error) {
    await db
      .update(schema.promptArtifacts)
      .set({
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Storyboard cover generation failed",
      })
      .where(eq(schema.promptArtifacts.id, promptId));
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to generate storyboard cover",
    };
  }
}

export async function generateStoryboardCoverAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = storyIdSchema.parse({ storyId: formData.get("storyId") });
  const promptOverride = String(formData.get("coverPrompt") ?? "").trim() || null;
  const result = await generateStoryboardCover({
    storyId: payload.storyId,
    promptOverride,
  });
  revalidatePath(`/admin/stories/${payload.storyId}/storyboard`);
  revalidatePath(`/admin/stories/${payload.storyId}`);
  return result;
}

export async function saveStoryboardCoverPromptDraftAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = coverPromptDraftSchema.parse({
    storyId: formData.get("storyId"),
    promptOverride: formData.get("coverPrompt"),
  });
  const outlineReferenceUrl = getStoryboardOutlineReferenceUrl();
  if (!outlineReferenceUrl) {
    return {
      success: false,
      error:
        "Outline reference image URL is required. Set OUTLINE_IMAGE_URL or NEXT_PUBLIC_APP_URL.",
    };
  }
  const requestPayload = buildStoryboardCoverRequestPayload({
    prompt: payload.promptOverride.trim(),
    outlineReferenceUrl,
  });
  await db.insert(schema.promptArtifacts).values({
    id: newId(),
    entityType: "storyboard_cover_prompt_draft",
    entityId: payload.storyId,
    rawPrompt: payload.promptOverride.trim(),
    model: MODELS.nanoBananaPro,
    parameters: requestPayload,
    status: "success",
    createdAt: new Date(),
  });
  revalidatePath(`/admin/stories/${payload.storyId}/storyboard`);
  return { success: true, data: { id: payload.storyId } };
}

export async function generateStoryboardCoverFromRunAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = coverFromRunSchema.parse({
    storyId: formData.get("storyId"),
    runArtifactId: formData.get("runArtifactId"),
  });
  const artifactRows = await db
    .select()
    .from(schema.promptArtifacts)
    .where(eq(schema.promptArtifacts.id, payload.runArtifactId))
    .limit(1);
  const artifact = artifactRows[0];
  if (!artifact) return { success: false, error: "Run artifact not found" };
  if (artifact.entityType !== "storyboard_cover_image") {
    return { success: false, error: "Invalid run artifact type" };
  }
  if (artifact.entityId !== payload.storyId) {
    return { success: false, error: "Run artifact does not belong to this story" };
  }
  const parsedPayload = parseStoryboardCoverRequestPayload(artifact.parameters);
  if (!parsedPayload) {
    return { success: false, error: "Run artifact payload is missing or invalid" };
  }
  const result = await generateStoryboardCover({
    storyId: payload.storyId,
    requestPayloadOverride: parsedPayload,
  });
  revalidatePath(`/admin/stories/${payload.storyId}/storyboard`);
  revalidatePath(`/admin/stories/${payload.storyId}`);
  return result;
}

export async function saveStoryboardPanelPromptDraftAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = panelPromptDraftSchema.parse({
    storyId: formData.get("storyId"),
    panelId: formData.get("panelId"),
    promptOverride: formData.get("promptOverride"),
  });

  const panelRows = await db
    .select()
    .from(schema.storyboardPanels)
    .where(eq(schema.storyboardPanels.id, payload.panelId))
    .limit(1);
  const panel = panelRows[0];
  if (!panel) return { success: false, error: "Storyboard panel not found" };

  const outlineReferenceUrl = getStoryboardOutlineReferenceUrl();
  if (!outlineReferenceUrl) {
    return {
      success: false,
      error:
        "Outline reference image URL is required. Set OUTLINE_IMAGE_URL or NEXT_PUBLIC_APP_URL.",
    };
  }

  const requestPayload = buildStoryboardImageRequestPayload({
    prompt: payload.promptOverride.trim(),
    outlineReferenceUrl,
  });

  await db.insert(schema.promptArtifacts).values({
    id: newId(),
    entityType: "storyboard_panel_prompt_draft",
    entityId: payload.panelId,
    rawPrompt: payload.promptOverride.trim(),
    model: MODELS.nanoBananaPro,
    parameters: requestPayload,
    status: "success",
    createdAt: new Date(),
  });

  revalidatePath(`/admin/stories/${payload.storyId}/storyboard`);
  return { success: true, data: { id: payload.panelId } };
}

export async function generateStoryboardImagesAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = storyIdSchema.parse({
    storyId: formData.get("storyId"),
  });

  const storyRows = await db
    .select()
    .from(schema.stories)
    .where(eq(schema.stories.id, payload.storyId))
    .limit(1);
  const story = storyRows[0];
  if (!story) return { success: false, error: "Story not found" };

  const scenes = await db
    .select({ id: schema.storyScenes.id })
    .from(schema.storyScenes)
    .where(eq(schema.storyScenes.storyId, payload.storyId));
  const sceneIds = scenes.map((scene) => scene.id);
  if (sceneIds.length === 0) {
    return { success: false, error: "Generate scenes first" };
  }

  const panels = await db
    .select()
    .from(schema.storyboardPanels)
    .where(inArray(schema.storyboardPanels.sceneId, sceneIds));
  if (panels.length === 0) {
    return { success: false, error: "Generate storyboard compositions first" };
  }

  await db
    .update(schema.stories)
    .set({ status: "storyboard_generating_images" })
    .where(eq(schema.stories.id, payload.storyId));

  for (const panel of panels) {
    const result = await generateSinglePanelImage({
      storyId: payload.storyId,
      panelId: panel.id,
    });
    if (!result.success) {
      await db
        .update(schema.stories)
        .set({ status: "storyboard_failed" })
        .where(eq(schema.stories.id, payload.storyId));
      revalidatePath(`/admin/stories/${payload.storyId}/storyboard`);
      return result;
    }
  }

  await db
    .update(schema.stories)
    .set({ status: "storyboard_ready" })
    .where(eq(schema.stories.id, payload.storyId));

  revalidatePath(`/admin/stories/${payload.storyId}/storyboard`);
  revalidatePath(`/admin/stories/${payload.storyId}`);
  return { success: true, data: { id: payload.storyId } };
}

const updateCompositionSchema = z.object({
  background: z.string().optional().nullable(),
  foreground: z.string().optional().nullable(),
  environment: z.string().optional().nullable(),
  characterPose: z.string().optional().nullable(),
  composition: z.string().optional().nullable(),
  propsUsed: z.string().optional().nullable(),
});

export async function updateStoryboardCompositionAction(
  storyId: string,
  panelId: string,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = updateCompositionSchema.parse({
      background: formData.get("background"),
      foreground: formData.get("foreground"),
      environment: formData.get("environment"),
      characterPose: formData.get("characterPose"),
      composition: formData.get("composition"),
      propsUsed: formData.get("propsUsed"),
    });

    const propsUsed = parsed.propsUsed
      ? JSON.stringify(
          parsed.propsUsed
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        )
      : JSON.stringify([]);

    await db
      .update(schema.storyboardPanels)
      .set({
        background: parsed.background ?? "",
        foreground: parsed.foreground ?? "",
        environment: parsed.environment ?? "",
        characterPose: parsed.characterPose ?? "",
        composition: parsed.composition ?? "",
        propsUsed,
        status: "composed",
      })
      .where(eq(schema.storyboardPanels.id, panelId));

    revalidatePath(`/admin/stories/${storyId}/storyboard`);
    return { success: true, data: { id: panelId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update composition",
    };
  }
}

export async function setStoryboardPanelVersionAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = panelVersionSchema.parse({
    storyId: formData.get("storyId"),
    panelId: formData.get("panelId"),
    assetId: formData.get("assetId"),
  });

  const panelRows = await db
    .select()
    .from(schema.storyboardPanels)
    .where(eq(schema.storyboardPanels.id, payload.panelId))
    .limit(1);
  const panel = panelRows[0];
  if (!panel) return { success: false, error: "Storyboard panel not found" };

  const sceneRows = await db
    .select()
    .from(schema.storyScenes)
    .where(eq(schema.storyScenes.id, panel.sceneId))
    .limit(1);
  const scene = sceneRows[0];
  if (!scene || scene.storyId !== payload.storyId) {
    return { success: false, error: "Panel does not belong to this story" };
  }

  const assetRows = await db
    .select()
    .from(schema.generatedAssets)
    .where(eq(schema.generatedAssets.id, payload.assetId))
    .limit(1);
  const asset = assetRows[0];
  if (!asset || asset.type !== "storyboard_panel" || asset.entityId !== payload.panelId) {
    return { success: false, error: "Storyboard version not found" };
  }

  await db
    .update(schema.storyboardPanels)
    .set({
      imageUrl: asset.storageUrl,
      status: "generated",
    })
    .where(eq(schema.storyboardPanels.id, payload.panelId));

  revalidatePath(`/admin/stories/${payload.storyId}/storyboard`);
  revalidatePath(`/admin/stories/${payload.storyId}`);
  return { success: true, data: { id: payload.panelId } };
}

export async function deleteStoryboardPanelVersionAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = panelVersionSchema.parse({
    storyId: formData.get("storyId"),
    panelId: formData.get("panelId"),
    assetId: formData.get("assetId"),
  });

  const panelRows = await db
    .select()
    .from(schema.storyboardPanels)
    .where(eq(schema.storyboardPanels.id, payload.panelId))
    .limit(1);
  const panel = panelRows[0];
  if (!panel) return { success: false, error: "Storyboard panel not found" };

  const sceneRows = await db
    .select()
    .from(schema.storyScenes)
    .where(eq(schema.storyScenes.id, panel.sceneId))
    .limit(1);
  const scene = sceneRows[0];
  if (!scene || scene.storyId !== payload.storyId) {
    return { success: false, error: "Panel does not belong to this story" };
  }

  const assetRows = await db
    .select()
    .from(schema.generatedAssets)
    .where(eq(schema.generatedAssets.id, payload.assetId))
    .limit(1);
  const asset = assetRows[0];
  if (!asset || asset.type !== "storyboard_panel" || asset.entityId !== payload.panelId) {
    return { success: false, error: "Storyboard version not found" };
  }

  try {
    await deleteFromR2PublicUrl(asset.storageUrl);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? `Failed to delete image from storage: ${error.message}`
          : "Failed to delete image from storage",
    };
  }

  await db
    .delete(schema.generatedAssets)
    .where(eq(schema.generatedAssets.id, payload.assetId));

  if (panel.imageUrl === asset.storageUrl) {
    const remainingAssets = await db
      .select()
      .from(schema.generatedAssets)
      .where(eq(schema.generatedAssets.entityId, payload.panelId))
      .orderBy(asc(schema.generatedAssets.createdAt));
    const nextAsset = [...remainingAssets]
      .reverse()
      .find((candidate) => candidate.type === "storyboard_panel");
    await db
      .update(schema.storyboardPanels)
      .set({
        imageUrl: nextAsset?.storageUrl ?? null,
        status: nextAsset ? "generated" : "composed",
      })
      .where(eq(schema.storyboardPanels.id, payload.panelId));
  }

  revalidatePath(`/admin/stories/${payload.storyId}/storyboard`);
  revalidatePath(`/admin/stories/${payload.storyId}`);
  return { success: true, data: { id: payload.panelId } };
}
