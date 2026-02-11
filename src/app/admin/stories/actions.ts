"use server";

import { asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { generateText } from "@/lib/openai";
import {
  MODELS,
  createPrediction,
  extractImageUrl,
  getReplicateClient,
} from "@/lib/replicate";
import { copyFromTempUrl } from "@/lib/r2";
import {
  buildStoryCoverPrompt,
  getOutlineReferenceUrl,
} from "@/lib/prompts/cover";
import {
  buildSceneRegenerationPrompts,
  buildStoryConceptPrompts,
  buildStoryManuscriptPrompts,
  buildStoryScenesPrompts,
  parseAndValidateStoryConcept,
  parseAndValidateStoryManuscript,
  parseAndValidateStoryOutput,
  parseAndValidateStoryScene,
  storyAgeRanges,
  type StoryAgeRange,
} from "@/lib/prompts/story";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ActionResult<T> =
  | { success: true; data: T; warning?: string }
  | { success: false; error: string };

const createStorySchema = z.object({
  ageRange: z.enum(storyAgeRanges),
  theme: z.string().optional().nullable(),
});

const storyIdSchema = z.object({
  storyId: z.string().uuid(),
});

const regenerateSceneSchema = z.object({
  storyId: z.string().uuid(),
  sceneId: z.string().uuid(),
});

const updateStoryMetaSchema = z.object({
  title: z.string().optional().nullable(),
  storyArc: z.string().optional().nullable(),
  theme: z.string().optional().nullable(),
});

const updateSceneSchema = z.object({
  spreadText: z.string().min(1, "Scene text is required"),
  sceneDescription: z.string().min(1, "Scene description is required"),
});

function newId(): string {
  return crypto.randomUUID();
}

function normalizeTheme(theme?: string | null): string | null {
  if (!theme) return null;
  const trimmed = theme.trim();
  return trimmed.length ? trimmed : null;
}

async function insertArtifact(input: {
  entityType: string;
  entityId: string;
  rawPrompt: string;
  status: "success" | "failed";
  model?: string;
  structuredFields?: Record<string, unknown>;
  errorMessage?: string;
}) {
  await db.insert(schema.promptArtifacts).values({
    id: newId(),
    entityType: input.entityType,
    entityId: input.entityId,
    rawPrompt: input.rawPrompt,
    model: input.model ?? "gpt-4o",
    status: input.status,
    structuredFields: input.structuredFields
      ? JSON.stringify(input.structuredFields)
      : null,
    errorMessage: input.errorMessage ?? null,
  });
}

async function getLatestArtifactByPhase(storyId: string, phase: string) {
  const rows = await db
    .select()
    .from(schema.promptArtifacts)
    .where(eq(schema.promptArtifacts.entityId, storyId))
    .orderBy(desc(schema.promptArtifacts.createdAt))
    .limit(30);

  return (
    rows.find((row) => {
      if (!row.structuredFields) return false;
      try {
        const parsed = JSON.parse(row.structuredFields) as { phase?: string };
        return parsed.phase === phase;
      } catch {
        return false;
      }
    }) ?? null
  );
}

async function generateConceptStep(storyId: string): Promise<ActionResult<{ id: string }>> {
  const rows = await db
    .select()
    .from(schema.stories)
    .where(eq(schema.stories.id, storyId))
    .limit(1);
  const story = rows[0];
  if (!story || !story.ageRange) {
    return { success: false, error: "Story not found" };
  }

  const prompts = buildStoryConceptPrompts({
    ageRange: story.ageRange as StoryAgeRange,
    theme: story.theme,
  });

  await db
    .update(schema.stories)
    .set({ status: "concept_generating" })
    .where(eq(schema.stories.id, storyId));

  try {
    const raw = await generateText(
      [
        { role: "system", content: prompts.systemPrompt },
        { role: "user", content: prompts.userPrompt },
      ],
      { model: "gpt-4o", maxTokens: 1600, temperature: 0.7 }
    );
    const concept = parseAndValidateStoryConcept(raw);

    await insertArtifact({
      entityType: "story",
      entityId: storyId,
      rawPrompt: `${prompts.systemPrompt}\n\n${prompts.userPrompt}`,
      status: "success",
      structuredFields: { phase: "concept", concept },
    });

    await db
      .update(schema.stories)
      .set({ status: "concept_ready" })
      .where(eq(schema.stories.id, storyId));

    revalidatePath(`/admin/stories/${storyId}`);
    revalidatePath("/admin/stories");
    return { success: true, data: { id: storyId } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate concept";
    await insertArtifact({
      entityType: "story",
      entityId: storyId,
      rawPrompt: `${prompts.systemPrompt}\n\n${prompts.userPrompt}`,
      status: "failed",
      errorMessage: message,
      structuredFields: { phase: "concept" },
    });
    await db
      .update(schema.stories)
      .set({ status: "concept_failed" })
      .where(eq(schema.stories.id, storyId));
    revalidatePath(`/admin/stories/${storyId}`);
    return { success: false, error: message };
  }
}

export async function createStoryAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createStorySchema.parse({
      ageRange: formData.get("ageRange"),
      theme: formData.get("theme"),
    });

    const id = newId();
    await db.insert(schema.stories).values({
      id,
      ageRange: parsed.ageRange,
      theme: normalizeTheme(parsed.theme),
      status: "draft",
    });

    return await generateConceptStep(id);
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.errors.map((issue) => issue.message).join(", ")
        : "Failed to create story";
    return { success: false, error: message };
  }
}

export async function regenerateConceptAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = storyIdSchema.parse({ storyId: formData.get("storyId") });
  return generateConceptStep(payload.storyId);
}

export async function generateManuscriptAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = storyIdSchema.parse({ storyId: formData.get("storyId") });
  const rows = await db
    .select()
    .from(schema.stories)
    .where(eq(schema.stories.id, payload.storyId))
    .limit(1);
  const story = rows[0];
  if (!story || !story.ageRange) {
    return { success: false, error: "Story not found" };
  }

  const conceptArtifact = await getLatestArtifactByPhase(payload.storyId, "concept");
  if (!conceptArtifact?.structuredFields) {
    return { success: false, error: "Generate concept first" };
  }

  let concept: unknown;
  try {
    concept = (JSON.parse(conceptArtifact.structuredFields) as { concept: unknown }).concept;
  } catch {
    return { success: false, error: "Invalid concept artifact" };
  }

  const prompts = buildStoryManuscriptPrompts({
    ageRange: story.ageRange as StoryAgeRange,
    theme: story.theme,
    conceptJson: JSON.stringify(concept),
  });

  await db
    .update(schema.stories)
    .set({ status: "manuscript_generating" })
    .where(eq(schema.stories.id, payload.storyId));

  try {
    const raw = await generateText(
      [
        { role: "system", content: prompts.systemPrompt },
        { role: "user", content: prompts.userPrompt },
      ],
      { model: "gpt-4o", maxTokens: 1200, temperature: 0.7 }
    );
    const manuscript = parseAndValidateStoryManuscript(raw);

    await insertArtifact({
      entityType: "story",
      entityId: payload.storyId,
      rawPrompt: `${prompts.systemPrompt}\n\n${prompts.userPrompt}`,
      status: "success",
      structuredFields: { phase: "manuscript", manuscript },
    });

    await db
      .update(schema.stories)
      .set({
        title: manuscript.title,
        storyArc: manuscript.arcSummary,
        status: "manuscript_ready",
      })
      .where(eq(schema.stories.id, payload.storyId));

    revalidatePath(`/admin/stories/${payload.storyId}`);
    revalidatePath("/admin/stories");
    return { success: true, data: { id: payload.storyId } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate manuscript";
    await insertArtifact({
      entityType: "story",
      entityId: payload.storyId,
      rawPrompt: `${prompts.systemPrompt}\n\n${prompts.userPrompt}`,
      status: "failed",
      errorMessage: message,
      structuredFields: { phase: "manuscript" },
    });
    await db
      .update(schema.stories)
      .set({ status: "manuscript_failed" })
      .where(eq(schema.stories.id, payload.storyId));
    revalidatePath(`/admin/stories/${payload.storyId}`);
    return { success: false, error: message };
  }
}

export async function generateScenesAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = storyIdSchema.parse({ storyId: formData.get("storyId") });
  const rows = await db
    .select()
    .from(schema.stories)
    .where(eq(schema.stories.id, payload.storyId))
    .limit(1);
  const story = rows[0];
  if (!story || !story.ageRange) {
    return { success: false, error: "Story not found" };
  }

  const conceptArtifact = await getLatestArtifactByPhase(payload.storyId, "concept");
  const manuscriptArtifact = await getLatestArtifactByPhase(payload.storyId, "manuscript");
  if (!conceptArtifact?.structuredFields || !manuscriptArtifact?.structuredFields) {
    return { success: false, error: "Generate concept and manuscript first" };
  }

  let concept: unknown;
  let manuscript: unknown;
  try {
    concept = (JSON.parse(conceptArtifact.structuredFields) as { concept: unknown }).concept;
    manuscript = (JSON.parse(manuscriptArtifact.structuredFields) as {
      manuscript: unknown;
    }).manuscript;
  } catch {
    return { success: false, error: "Invalid concept or manuscript artifact" };
  }

  const prompts = buildStoryScenesPrompts({
    ageRange: story.ageRange as StoryAgeRange,
    theme: story.theme,
    conceptJson: JSON.stringify(concept),
    manuscriptJson: JSON.stringify(manuscript),
  });

  await db
    .update(schema.stories)
    .set({ status: "scenes_generating" })
    .where(eq(schema.stories.id, payload.storyId));

  try {
    const raw = await generateText(
      [
        { role: "system", content: prompts.systemPrompt },
        { role: "user", content: prompts.userPrompt },
      ],
      { model: "gpt-4o", maxTokens: 4096, temperature: 0.7 }
    );
    const scenes = parseAndValidateStoryOutput(raw);

    await insertArtifact({
      entityType: "story",
      entityId: payload.storyId,
      rawPrompt: `${prompts.systemPrompt}\n\n${prompts.userPrompt}`,
      status: "success",
      structuredFields: {
        phase: "scenes",
        sceneCount: scenes.length,
      },
    });

    await db
      .delete(schema.storyScenes)
      .where(eq(schema.storyScenes.storyId, payload.storyId));
    await db.insert(schema.storyScenes).values(
      scenes.map((scene) => ({
        id: newId(),
        storyId: payload.storyId,
        sceneNumber: scene.sceneNumber,
        spreadText: scene.spreadText,
        sceneDescription: scene.sceneDescription,
      }))
    );

    await db
      .update(schema.stories)
      .set({ status: "scenes_ready" })
      .where(eq(schema.stories.id, payload.storyId));

    revalidatePath(`/admin/stories/${payload.storyId}`);
    revalidatePath("/admin/stories");
    return { success: true, data: { id: payload.storyId } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate scenes";
    await insertArtifact({
      entityType: "story",
      entityId: payload.storyId,
      rawPrompt: `${prompts.systemPrompt}\n\n${prompts.userPrompt}`,
      status: "failed",
      errorMessage: message,
      structuredFields: { phase: "scenes" },
    });
    await db
      .update(schema.stories)
      .set({ status: "scenes_failed" })
      .where(eq(schema.stories.id, payload.storyId));
    revalidatePath(`/admin/stories/${payload.storyId}`);
    return { success: false, error: message };
  }
}

export async function updateStoryMetaAction(
  storyId: string,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = updateStoryMetaSchema.parse({
      title: formData.get("title"),
      storyArc: formData.get("storyArc"),
      theme: formData.get("theme"),
    });

    const setValues: {
      title: string | null;
      storyArc: string | null;
      theme?: string | null;
    } = {
      title: parsed.title?.trim() || null,
      storyArc: parsed.storyArc?.trim() || null,
    };
    if (formData.has("theme")) {
      setValues.theme = normalizeTheme(parsed.theme);
    }

    await db
      .update(schema.stories)
      .set(setValues)
      .where(eq(schema.stories.id, storyId));

    revalidatePath(`/admin/stories/${storyId}`);
    revalidatePath("/admin/stories");
    return { success: true, data: { id: storyId } };
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.errors.map((issue) => issue.message).join(", ")
        : "Failed to update story";
    return { success: false, error: message };
  }
}

export async function updateSceneAction(
  storyId: string,
  sceneId: string,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = updateSceneSchema.parse({
      spreadText: formData.get("spreadText"),
      sceneDescription: formData.get("sceneDescription"),
    });

    await db
      .update(schema.storyScenes)
      .set({
        spreadText: parsed.spreadText,
        sceneDescription: parsed.sceneDescription,
        updatedAt: new Date(),
      })
      .where(eq(schema.storyScenes.id, sceneId));

    revalidatePath(`/admin/stories/${storyId}`);
    return { success: true, data: { id: sceneId } };
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.errors.map((issue) => issue.message).join(", ")
        : "Failed to update scene";
    return { success: false, error: message };
  }
}

export async function regenerateSceneAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = regenerateSceneSchema.parse({
    storyId: formData.get("storyId"),
    sceneId: formData.get("sceneId"),
  });

  const storyRows = await db
    .select()
    .from(schema.stories)
    .where(eq(schema.stories.id, payload.storyId))
    .limit(1);
  const story = storyRows[0];
  if (!story || !story.ageRange) {
    return { success: false, error: "Story not found" };
  }

  const scenes = await db
    .select()
    .from(schema.storyScenes)
    .where(eq(schema.storyScenes.storyId, payload.storyId))
    .orderBy(asc(schema.storyScenes.sceneNumber));
  const index = scenes.findIndex((scene) => scene.id === payload.sceneId);
  const current = scenes[index];
  if (!current) {
    return { success: false, error: "Scene not found" };
  }
  const fullStoryContext = scenes
    .map((scene) =>
      `Scene ${scene.sceneNumber}: text=${scene.spreadText ?? ""} description=${scene.sceneDescription ?? ""}`
    )
    .join("\n");

  const prompts = buildSceneRegenerationPrompts({
    ageRange: story.ageRange as StoryAgeRange,
    sceneNumber: current.sceneNumber,
    fullStoryContext,
    currentSceneText: current.spreadText ?? "",
    theme: story.theme,
  });

  try {
    const raw = await generateText(
      [
        { role: "system", content: prompts.systemPrompt },
        { role: "user", content: prompts.userPrompt },
      ],
      {
        model: "gpt-4o",
        maxTokens: 1200,
        temperature: 0.7,
      }
    );
    const parsed = parseAndValidateStoryScene(raw);

    await insertArtifact({
      entityType: "story_scene",
      entityId: current.id,
      rawPrompt: `${prompts.systemPrompt}\n\n${prompts.userPrompt}`,
      status: "success",
      structuredFields: { phase: "scene_regenerate", sceneNumber: current.sceneNumber },
    });

    await db
      .update(schema.storyScenes)
      .set({
        spreadText: parsed.spreadText,
        sceneDescription: parsed.sceneDescription,
        updatedAt: new Date(),
      })
      .where(eq(schema.storyScenes.id, current.id));

    revalidatePath(`/admin/stories/${payload.storyId}`);
    return { success: true, data: { id: current.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scene regeneration failed";
    await insertArtifact({
      entityType: "story_scene",
      entityId: current.id,
      rawPrompt: `${prompts.systemPrompt}\n\n${prompts.userPrompt}`,
      status: "failed",
      errorMessage: message,
      structuredFields: { phase: "scene_regenerate", sceneNumber: current.sceneNumber },
    });
    return { success: false, error: message };
  }
}

export async function generateStoryCoverAction(
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
  if (!story) {
    return { success: false, error: "Story not found" };
  }

  const scenes = await db
    .select()
    .from(schema.storyScenes)
    .where(eq(schema.storyScenes.storyId, payload.storyId))
    .orderBy(asc(schema.storyScenes.sceneNumber));
  if (scenes.length === 0) {
    return { success: false, error: "Generate scenes first" };
  }

  const propRows = await db
    .select()
    .from(schema.propsBibleEntries)
    .where(eq(schema.propsBibleEntries.storyId, payload.storyId))
    .limit(8);

  const sceneSummary = scenes
    .slice(0, 6)
    .map((scene) => scene.sceneDescription ?? scene.spreadText ?? "")
    .filter(Boolean)
    .join(" | ");
  const propsSummary = propRows.map((prop) => prop.title).join(", ");
  const outlineReferenceUrl = getOutlineReferenceUrl();
  const generatedCoverPrompt = buildStoryCoverPrompt({
    title: story.title,
    storyArc: story.storyArc,
    sceneSummary,
    propsSummary,
    outlineReferenceUrl,
  });
  const submittedCoverPrompt = String(formData.get("coverPrompt") ?? "").trim();
  const coverPrompt = submittedCoverPrompt || generatedCoverPrompt;

  const promptId = newId();
  await db.insert(schema.promptArtifacts).values({
    id: promptId,
    entityType: "story_cover",
    entityId: payload.storyId,
    rawPrompt: coverPrompt,
    model: MODELS.nanoBananaPro,
    status: "running",
  });

  try {
    const prediction = await createPrediction(MODELS.nanoBananaPro, {
      prompt: coverPrompt,
      aspect_ratio: "2:3",
      output_format: "png",
      ...(outlineReferenceUrl ? { image: outlineReferenceUrl } : {}),
    });

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
      throw new Error("Replicate did not return an image URL for cover");
    }

    const assetId = newId();
    const storageUrl = await copyFromTempUrl(
      tempUrl,
      `stories/${payload.storyId}/cover/${assetId}.png`
    );

    await db.insert(schema.generatedAssets).values({
      id: assetId,
      type: "story_cover",
      entityId: payload.storyId,
      storageUrl,
      mimeType: "image/png",
      metadata: JSON.stringify({ promptId }),
    });

    await db
      .update(schema.promptArtifacts)
      .set({ status: "success", resultUrl: storageUrl })
      .where(eq(schema.promptArtifacts.id, promptId));

    revalidatePath(`/admin/stories/${payload.storyId}`);
    return { success: true, data: { id: payload.storyId } };
  } catch (error) {
    await db
      .update(schema.promptArtifacts)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Cover generation failed",
      })
      .where(eq(schema.promptArtifacts.id, promptId));
    return {
      success: false,
      error: error instanceof Error ? error.message : "Cover generation failed",
    };
  }
}

export async function deleteStoryAction(formData: FormData) {
  const payload = storyIdSchema.parse({
    storyId: formData.get("storyId"),
  });

  const sceneRows = await db
    .select({ id: schema.storyScenes.id })
    .from(schema.storyScenes)
    .where(eq(schema.storyScenes.storyId, payload.storyId));
  const sceneIds = sceneRows.map((scene) => scene.id);
  if (sceneIds.length > 0) {
    await db
      .delete(schema.storyboardPanels)
      .where(inArray(schema.storyboardPanels.sceneId, sceneIds));
    await db
      .delete(schema.finalPages)
      .where(inArray(schema.finalPages.sceneId, sceneIds));
  }
  await db
    .delete(schema.storyScenes)
    .where(eq(schema.storyScenes.storyId, payload.storyId));
  await db
    .delete(schema.propsBibleEntries)
    .where(eq(schema.propsBibleEntries.storyId, payload.storyId));
  await db
    .delete(schema.promptArtifacts)
    .where(eq(schema.promptArtifacts.entityId, payload.storyId));
  await db
    .delete(schema.generatedAssets)
    .where(eq(schema.generatedAssets.entityId, payload.storyId));
  await db.delete(schema.stories).where(eq(schema.stories.id, payload.storyId));

  revalidatePath("/admin/stories");
  redirect("/admin/stories");
}
