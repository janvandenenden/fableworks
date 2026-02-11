"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import {
  MODELS,
  createPrediction,
  extractImageUrl,
  getReplicateClient,
} from "@/lib/replicate";
import { copyFromTempUrl } from "@/lib/r2";
import { consumeGenerationCreditForUser } from "@/lib/credits";
import {
  buildFinalPagePrompt,
  buildFinalPageRequestPayload,
} from "@/lib/prompts/final-page";
import { buildFinalCoverPrompt } from "@/lib/prompts/final-cover";
import { revalidatePath } from "next/cache";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const storyIdSchema = z.object({
  storyId: z.string().uuid(),
});

const pageImageSchema = z.object({
  storyId: z.string().uuid(),
  sceneId: z.string().uuid(),
  promptOverride: z.string().optional().nullable(),
  characterId: z.string().uuid().optional().nullable(),
});

const pageImageFromRunSchema = z.object({
  storyId: z.string().uuid(),
  sceneId: z.string().uuid(),
  runArtifactId: z.string().uuid(),
  characterId: z.string().uuid().optional().nullable(),
});

const pagePromptDraftSchema = z.object({
  storyId: z.string().uuid(),
  sceneId: z.string().uuid(),
  promptOverride: z.string().min(1, "Prompt cannot be empty"),
  characterId: z.string().uuid().optional().nullable(),
});

const approveFinalPageSchema = z.object({
  storyId: z.string().uuid(),
  finalPageId: z.string().uuid(),
  approved: z.enum(["true", "false"]),
});

const finalPageRequestPayloadSchema = z.object({
  prompt: z.string().min(1),
  aspect_ratio: z.string().min(1),
  output_format: z.string().min(1),
  image: z.array(z.string().min(1)).min(2),
});
const finalCoverSchema = z.object({
  storyId: z.string().uuid(),
  promptOverride: z.string().optional().nullable(),
  characterId: z.string().uuid().optional().nullable(),
});
const finalCoverFromRunSchema = z.object({
  storyId: z.string().uuid(),
  runArtifactId: z.string().uuid(),
  characterId: z.string().uuid().optional().nullable(),
});
const finalCoverPromptDraftSchema = z.object({
  storyId: z.string().uuid(),
  promptOverride: z.string().min(1, "Prompt cannot be empty"),
  characterId: z.string().uuid().optional().nullable(),
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

function parseRequestPayload(
  value: unknown
): z.infer<typeof finalPageRequestPayloadSchema> | null {
  if (!value) return null;
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  const result = finalPageRequestPayloadSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

function hasDualReferenceImages(
  payload: z.infer<typeof finalPageRequestPayloadSchema>
): boolean {
  return Array.isArray(payload.image) && payload.image.length >= 2;
}

async function buildFinalPageGenerationContext(input: {
  storyId: string;
  sceneId: string;
  characterIdOverride?: string | null;
}) {
  const storyRows = await db
    .select()
    .from(schema.stories)
    .where(eq(schema.stories.id, input.storyId))
    .limit(1);
  const story = storyRows[0];
  if (!story) {
    return { success: false as const, error: "Story not found" };
  }
  const activeCharacterId = input.characterIdOverride ?? story.characterId;
  if (!activeCharacterId) {
    return {
      success: false as const,
      error:
        "No character provided. Link a character to the story or select one in Final Pages.",
    };
  }

  const characterRows = await db
    .select({
      id: schema.characters.id,
      stylePreset: schema.characters.stylePreset,
      name: schema.characters.name,
    })
    .from(schema.characters)
    .where(eq(schema.characters.id, activeCharacterId))
    .limit(1);
  const character = characterRows[0];
  if (!character) {
    return { success: false as const, error: "Character not found for this story" };
  }

  const sceneRows = await db
    .select()
    .from(schema.storyScenes)
    .where(eq(schema.storyScenes.id, input.sceneId))
    .limit(1);
  const scene = sceneRows[0];
  if (!scene) {
    return { success: false as const, error: "Scene not found" };
  }
  if (scene.storyId !== input.storyId) {
    return {
      success: false as const,
      error: "Scene does not belong to this story",
    };
  }

  const panelRows = await db
    .select()
    .from(schema.storyboardPanels)
    .where(eq(schema.storyboardPanels.sceneId, scene.id))
    .limit(1);
  const panel = panelRows[0];
  if (!panel || !panel.imageUrl) {
    return {
      success: false as const,
      error: `Storyboard panel image is missing for scene ${scene.sceneNumber}`,
    };
  }

  const selectedImageRows = await db
    .select({
      imageUrl: schema.characterImages.imageUrl,
    })
    .from(schema.characterImages)
    .where(
      and(
        eq(schema.characterImages.characterId, activeCharacterId),
        eq(schema.characterImages.isSelected, true)
      )
    )
    .limit(1);
  const selectedImage = selectedImageRows[0];
  if (!selectedImage) {
    return {
      success: false as const,
      error: "No selected character image found. Select a character variant first.",
    };
  }

  const profileRows = await db
    .select({
      approxAge: schema.characterProfiles.approxAge,
      hairColor: schema.characterProfiles.hairColor,
      hairLength: schema.characterProfiles.hairLength,
      hairTexture: schema.characterProfiles.hairTexture,
      hairStyle: schema.characterProfiles.hairStyle,
      faceShape: schema.characterProfiles.faceShape,
      eyeColor: schema.characterProfiles.eyeColor,
      eyeShape: schema.characterProfiles.eyeShape,
      skinTone: schema.characterProfiles.skinTone,
      clothing: schema.characterProfiles.clothing,
      distinctiveFeatures: schema.characterProfiles.distinctiveFeatures,
      colorPalette: schema.characterProfiles.colorPalette,
      doNotChange: schema.characterProfiles.doNotChange,
    })
    .from(schema.characterProfiles)
    .where(eq(schema.characterProfiles.characterId, activeCharacterId))
    .limit(1);
  const profile = profileRows[0];
  if (!profile) {
    return {
      success: false as const,
      error: "Character profile not found. Regenerate character profile first.",
    };
  }

  const allProps = await db
    .select({
      title: schema.propsBibleEntries.title,
      description: schema.propsBibleEntries.description,
      appearsInScenes: schema.propsBibleEntries.appearsInScenes,
    })
    .from(schema.propsBibleEntries)
    .where(eq(schema.propsBibleEntries.storyId, input.storyId));
  const linkedProps = allProps
    .filter((prop) => parseSceneNumbers(prop.appearsInScenes).includes(scene.sceneNumber))
    .map((prop) => ({
      title: prop.title,
      description: prop.description,
    }));

  const profileSummary = [
    profile.approxAge ? `approx age: ${profile.approxAge}` : null,
    profile.hairColor ? `hair color: ${profile.hairColor}` : null,
    profile.hairLength ? `hair length: ${profile.hairLength}` : null,
    profile.hairTexture ? `hair texture: ${profile.hairTexture}` : null,
    profile.hairStyle ? `hair style: ${profile.hairStyle}` : null,
    profile.faceShape ? `face shape: ${profile.faceShape}` : null,
    profile.eyeColor ? `eye color: ${profile.eyeColor}` : null,
    profile.eyeShape ? `eye shape: ${profile.eyeShape}` : null,
    profile.skinTone ? `skin tone: ${profile.skinTone}` : null,
    profile.clothing ? `clothing: ${profile.clothing}` : null,
    profile.distinctiveFeatures ? `distinctive features: ${profile.distinctiveFeatures}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  const colorPalette = parseStringArray(profile.colorPalette ?? null);
  const doNotChange = parseStringArray(profile.doNotChange ?? null);

  return {
    success: true as const,
    data: {
      story,
      scene,
      panel,
      selectedImage,
      linkedProps,
      colorPalette,
      doNotChange,
      stylePreset: character.stylePreset,
      characterId: character.id,
      characterName: character.name,
      characterProfileSummary: profileSummary,
    },
  };
}

async function buildFinalCoverGenerationContext(input: {
  storyId: string;
  characterIdOverride?: string | null;
}) {
  const storyRows = await db
    .select()
    .from(schema.stories)
    .where(eq(schema.stories.id, input.storyId))
    .limit(1);
  const story = storyRows[0];
  if (!story) {
    return { success: false as const, error: "Story not found" };
  }

  const activeCharacterId = input.characterIdOverride ?? story.characterId;
  if (!activeCharacterId) {
    return {
      success: false as const,
      error: "No character provided. Link a character or select one for final cover generation.",
    };
  }

  const characterRows = await db
    .select({
      id: schema.characters.id,
      stylePreset: schema.characters.stylePreset,
      name: schema.characters.name,
    })
    .from(schema.characters)
    .where(eq(schema.characters.id, activeCharacterId))
    .limit(1);
  const character = characterRows[0];
  if (!character) {
    return { success: false as const, error: "Character not found" };
  }

  const selectedImageRows = await db
    .select({
      imageUrl: schema.characterImages.imageUrl,
    })
    .from(schema.characterImages)
    .where(
      and(
        eq(schema.characterImages.characterId, activeCharacterId),
        eq(schema.characterImages.isSelected, true)
      )
    )
    .limit(1);
  const selectedImage = selectedImageRows[0];
  if (!selectedImage) {
    return {
      success: false as const,
      error: "No selected character image found. Select a character variant first.",
    };
  }

  const profileRows = await db
    .select({
      approxAge: schema.characterProfiles.approxAge,
      hairColor: schema.characterProfiles.hairColor,
      hairLength: schema.characterProfiles.hairLength,
      hairTexture: schema.characterProfiles.hairTexture,
      hairStyle: schema.characterProfiles.hairStyle,
      faceShape: schema.characterProfiles.faceShape,
      eyeColor: schema.characterProfiles.eyeColor,
      eyeShape: schema.characterProfiles.eyeShape,
      skinTone: schema.characterProfiles.skinTone,
      clothing: schema.characterProfiles.clothing,
      distinctiveFeatures: schema.characterProfiles.distinctiveFeatures,
    })
    .from(schema.characterProfiles)
    .where(eq(schema.characterProfiles.characterId, activeCharacterId))
    .limit(1);
  const profile = profileRows[0];
  if (!profile) {
    return {
      success: false as const,
      error: "Character profile not found. Regenerate character profile first.",
    };
  }

  const storyboardCoverRows = await db
    .select({
      storageUrl: schema.generatedAssets.storageUrl,
      createdAt: schema.generatedAssets.createdAt,
    })
    .from(schema.generatedAssets)
    .where(
      and(
        eq(schema.generatedAssets.entityId, input.storyId),
        eq(schema.generatedAssets.type, "story_cover")
      )
    )
    .orderBy(asc(schema.generatedAssets.createdAt));
  const storyboardCover = storyboardCoverRows[storyboardCoverRows.length - 1];
  if (!storyboardCover?.storageUrl) {
    return {
      success: false as const,
      error: "Storyboard cover sketch missing. Generate a storyboard cover first.",
    };
  }

  const profileSummary = [
    profile.approxAge ? `approx age: ${profile.approxAge}` : null,
    profile.hairColor ? `hair color: ${profile.hairColor}` : null,
    profile.hairLength ? `hair length: ${profile.hairLength}` : null,
    profile.hairTexture ? `hair texture: ${profile.hairTexture}` : null,
    profile.hairStyle ? `hair style: ${profile.hairStyle}` : null,
    profile.faceShape ? `face shape: ${profile.faceShape}` : null,
    profile.eyeColor ? `eye color: ${profile.eyeColor}` : null,
    profile.eyeShape ? `eye shape: ${profile.eyeShape}` : null,
    profile.skinTone ? `skin tone: ${profile.skinTone}` : null,
    profile.clothing ? `clothing: ${profile.clothing}` : null,
    profile.distinctiveFeatures ? `distinctive features: ${profile.distinctiveFeatures}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  return {
    success: true as const,
    data: {
      story,
      storyboardCoverUrl: storyboardCover.storageUrl,
      selectedImageUrl: selectedImage.imageUrl,
      characterId: character.id,
      characterName: character.name,
      stylePreset: character.stylePreset,
      characterProfileSummary: profileSummary,
    },
  };
}

async function generateSingleFinalPage(input: {
  storyId: string;
  sceneId: string;
  promptOverride?: string | null;
  characterIdOverride?: string | null;
  requestPayloadOverride?: z.infer<typeof finalPageRequestPayloadSchema> | null;
}): Promise<ActionResult<{ id: string }>> {
  const contextResult = await buildFinalPageGenerationContext({
    storyId: input.storyId,
    sceneId: input.sceneId,
    characterIdOverride: input.characterIdOverride,
  });
  if (!contextResult.success) {
    return { success: false, error: contextResult.error };
  }

  const { story, scene, panel, selectedImage, linkedProps, colorPalette, doNotChange } =
    contextResult.data;

  if (story.userId) {
    const creditResult = await consumeGenerationCreditForUser({
      userId: story.userId,
      operation: "final_page_generation",
      metadata: {
        storyId: input.storyId,
        sceneId: input.sceneId,
        characterId: contextResult.data.characterId,
      },
    });
    if (!creditResult.success) {
      return { success: false, error: creditResult.error };
    }
  }

  const generatedPrompt = buildFinalPagePrompt({
    sceneNumber: scene.sceneNumber,
    spreadText: scene.spreadText,
    sceneDescription: scene.sceneDescription,
    storyboardComposition: panel.composition,
    storyboardBackground: panel.background,
    storyboardForeground: panel.foreground,
    storyboardEnvironment: panel.environment,
    storyboardCharacterPose: panel.characterPose,
    stylePreset: contextResult.data.stylePreset,
    colorPalette,
    characterProfileSummary: contextResult.data.characterProfileSummary,
    doNotChange,
    linkedProps,
    characterReferenceUrl: selectedImage.imageUrl,
    storyboardReferenceUrl: panel.imageUrl,
  });

  const prompt = input.promptOverride?.trim() || generatedPrompt;
  const requestPayloadBase =
    input.requestPayloadOverride ??
    buildFinalPageRequestPayload({
      prompt,
      storyboardReferenceUrl: panel.imageUrl,
      characterReferenceUrl: selectedImage.imageUrl,
    });
  const requestPayload = {
    ...requestPayloadBase,
    // Always use live scene + character references, even when reusing a stored run payload.
    image: [panel.imageUrl, selectedImage.imageUrl],
  };
  if (!hasDualReferenceImages(requestPayload)) {
    return {
      success: false,
      error:
        "Final page generation requires both storyboard and character reference images.",
    };
  }

  const promptId = newId();
  await db.insert(schema.promptArtifacts).values({
    id: promptId,
    entityType: "final_page_image",
    entityId: scene.id,
    rawPrompt: requestPayload.prompt,
    model: MODELS.nanoBanana,
    parameters: requestPayload,
    structuredFields: JSON.stringify({
      characterId: contextResult.data.characterId,
      characterName: contextResult.data.characterName,
    }),
    status: "running",
    createdAt: new Date(),
  });

  try {
    const prediction = await createPrediction(MODELS.nanoBanana, requestPayload);
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
      throw new Error("Replicate did not return an image URL for final page");
    }

    const existingPages = await db
      .select({ version: schema.finalPages.version })
      .from(schema.finalPages)
      .where(eq(schema.finalPages.sceneId, scene.id))
      .orderBy(asc(schema.finalPages.version));
    const latestVersion = existingPages[existingPages.length - 1]?.version ?? 0;
    const nextVersion = latestVersion + 1;

    const finalPageId = newId();
    const storageUrl = await copyFromTempUrl(
      tempUrl,
      `stories/${story.id}/pages/scene-${scene.sceneNumber}-v${nextVersion}.png`
    );

    await db.insert(schema.finalPages).values({
      id: finalPageId,
      sceneId: scene.id,
      imageUrl: storageUrl,
      promptArtifactId: promptId,
      version: nextVersion,
      isApproved: false,
    });

    await db.insert(schema.generatedAssets).values({
      id: newId(),
      type: "final_page",
      entityId: finalPageId,
      storageUrl,
      mimeType: "image/png",
      metadata: JSON.stringify({
        promptId,
        sceneId: scene.id,
        version: nextVersion,
        characterId: contextResult.data.characterId,
        characterName: contextResult.data.characterName,
      }),
    });

    await db
      .update(schema.promptArtifacts)
      .set({
        status: "success",
        resultUrl: storageUrl,
      })
      .where(eq(schema.promptArtifacts.id, promptId));

    return { success: true, data: { id: finalPageId } };
  } catch (error) {
    await db
      .update(schema.promptArtifacts)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Final page generation failed",
      })
      .where(eq(schema.promptArtifacts.id, promptId));
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate final page",
    };
  }
}

export async function generateFinalPageAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = pageImageSchema.parse({
    storyId: formData.get("storyId"),
    sceneId: formData.get("sceneId"),
    promptOverride: formData.get("promptOverride"),
    characterId: formData.get("characterId"),
  });
  const result = await generateSingleFinalPage({
    storyId: payload.storyId,
    sceneId: payload.sceneId,
    promptOverride: payload.promptOverride ?? null,
    characterIdOverride: payload.characterId ?? null,
  });
  revalidatePath(`/admin/stories/${payload.storyId}/pages`);
  revalidatePath(`/admin/stories/${payload.storyId}`);
  return result;
}

export async function generateFinalPageFromRunAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = pageImageFromRunSchema.parse({
    storyId: formData.get("storyId"),
    sceneId: formData.get("sceneId"),
    runArtifactId: formData.get("runArtifactId"),
    characterId: formData.get("characterId"),
  });

  const artifactRows = await db
    .select()
    .from(schema.promptArtifacts)
    .where(eq(schema.promptArtifacts.id, payload.runArtifactId))
    .limit(1);
  const artifact = artifactRows[0];
  if (!artifact) return { success: false, error: "Run artifact not found" };
  if (artifact.entityType !== "final_page_image") {
    return { success: false, error: "Invalid run artifact type" };
  }
  if (artifact.entityId !== payload.sceneId) {
    return { success: false, error: "Run artifact does not belong to this scene" };
  }

  const parsedPayload = parseRequestPayload(artifact.parameters);
  if (!parsedPayload) {
    return { success: false, error: "Run artifact payload is missing or invalid" };
  }

  const result = await generateSingleFinalPage({
    storyId: payload.storyId,
    sceneId: payload.sceneId,
    characterIdOverride: payload.characterId ?? null,
    requestPayloadOverride: parsedPayload,
  });
  revalidatePath(`/admin/stories/${payload.storyId}/pages`);
  revalidatePath(`/admin/stories/${payload.storyId}`);
  return result;
}

export async function saveFinalPagePromptDraftAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = pagePromptDraftSchema.parse({
    storyId: formData.get("storyId"),
    sceneId: formData.get("sceneId"),
    promptOverride: formData.get("promptOverride"),
    characterId: formData.get("characterId"),
  });

  const contextResult = await buildFinalPageGenerationContext({
    storyId: payload.storyId,
    sceneId: payload.sceneId,
    characterIdOverride: payload.characterId ?? null,
  });
  if (!contextResult.success) {
    return { success: false, error: contextResult.error };
  }

  const requestPayload = buildFinalPageRequestPayload({
    prompt: payload.promptOverride.trim(),
    storyboardReferenceUrl: contextResult.data.panel.imageUrl,
    characterReferenceUrl: contextResult.data.selectedImage.imageUrl,
  });

  await db.insert(schema.promptArtifacts).values({
    id: newId(),
    entityType: "final_page_prompt_draft",
    entityId: payload.sceneId,
    rawPrompt: payload.promptOverride.trim(),
    model: MODELS.nanoBanana,
    parameters: requestPayload,
    structuredFields: JSON.stringify({
      characterId: contextResult.data.characterId,
      characterName: contextResult.data.characterName,
    }),
    status: "success",
    createdAt: new Date(),
  });

  revalidatePath(`/admin/stories/${payload.storyId}/pages`);
  return { success: true, data: { id: payload.sceneId } };
}

export async function approveFinalPageVersionAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = approveFinalPageSchema.parse({
    storyId: formData.get("storyId"),
    finalPageId: formData.get("finalPageId"),
    approved: formData.get("approved"),
  });

  const finalPageRows = await db
    .select()
    .from(schema.finalPages)
    .where(eq(schema.finalPages.id, payload.finalPageId))
    .limit(1);
  const finalPage = finalPageRows[0];
  if (!finalPage) {
    return { success: false, error: "Final page not found" };
  }

  if (payload.approved === "true") {
    await db
      .update(schema.finalPages)
      .set({ isApproved: false })
      .where(eq(schema.finalPages.sceneId, finalPage.sceneId));
  }

  await db
    .update(schema.finalPages)
    .set({ isApproved: payload.approved === "true" })
    .where(eq(schema.finalPages.id, payload.finalPageId));

  revalidatePath(`/admin/stories/${payload.storyId}/pages`);
  return { success: true, data: { id: payload.finalPageId } };
}

export async function generateFinalPagesAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = storyIdSchema.parse({
    storyId: formData.get("storyId"),
  });
  const characterIdOverrideRaw = formData.get("characterId");
  const characterIdOverride =
    typeof characterIdOverrideRaw === "string" && characterIdOverrideRaw.trim().length > 0
      ? characterIdOverrideRaw
      : null;

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
    .select({
      id: schema.storyScenes.id,
      sceneNumber: schema.storyScenes.sceneNumber,
    })
    .from(schema.storyScenes)
    .where(eq(schema.storyScenes.storyId, payload.storyId))
    .orderBy(asc(schema.storyScenes.sceneNumber));
  if (scenes.length === 0) {
    return { success: false, error: "Generate scenes first" };
  }

  const panels = await db
    .select({
      sceneId: schema.storyboardPanels.sceneId,
      imageUrl: schema.storyboardPanels.imageUrl,
    })
    .from(schema.storyboardPanels)
    .where(inArray(schema.storyboardPanels.sceneId, scenes.map((scene) => scene.id)));
  if (panels.length !== scenes.length || panels.some((panel) => !panel.imageUrl)) {
    return {
      success: false,
      error: "Storyboard is incomplete. Generate all storyboard images first.",
    };
  }

  const existingFinalPages = await db
    .select({ sceneId: schema.finalPages.sceneId })
    .from(schema.finalPages)
    .where(inArray(schema.finalPages.sceneId, scenes.map((scene) => scene.id)));
  const existingSceneIds = new Set(existingFinalPages.map((page) => page.sceneId));
  const sceneIdsToGenerate = scenes
    .filter((scene) => !existingSceneIds.has(scene.id))
    .map((scene) => scene.id);

  if (sceneIdsToGenerate.length === 0) {
    await db
      .update(schema.stories)
      .set({ status: "pages_ready" })
      .where(eq(schema.stories.id, payload.storyId));
    revalidatePath(`/admin/stories/${payload.storyId}/pages`);
    revalidatePath(`/admin/stories/${payload.storyId}`);
    return { success: true, data: { id: payload.storyId } };
  }

  await db
    .update(schema.stories)
    .set({ status: "pages_generating" })
    .where(eq(schema.stories.id, payload.storyId));

  for (const sceneId of sceneIdsToGenerate) {
    const result = await generateSingleFinalPage({
      storyId: payload.storyId,
      sceneId,
      characterIdOverride,
    });
    if (!result.success) {
      await db
        .update(schema.stories)
        .set({ status: "pages_failed" })
        .where(eq(schema.stories.id, payload.storyId));
      revalidatePath(`/admin/stories/${payload.storyId}/pages`);
      revalidatePath(`/admin/stories/${payload.storyId}`);
      return result;
    }
  }

  await db
    .update(schema.stories)
    .set({ status: "pages_ready" })
    .where(eq(schema.stories.id, payload.storyId));

  revalidatePath(`/admin/stories/${payload.storyId}/pages`);
  revalidatePath(`/admin/stories/${payload.storyId}`);
  return { success: true, data: { id: payload.storyId } };
}

async function generateSingleFinalCover(input: {
  storyId: string;
  promptOverride?: string | null;
  characterIdOverride?: string | null;
  requestPayloadOverride?: z.infer<typeof finalPageRequestPayloadSchema> | null;
}): Promise<ActionResult<{ id: string }>> {
  const contextResult = await buildFinalCoverGenerationContext({
    storyId: input.storyId,
    characterIdOverride: input.characterIdOverride,
  });
  if (!contextResult.success) {
    return { success: false, error: contextResult.error };
  }

  const generatedPrompt = buildFinalCoverPrompt({
    title: contextResult.data.story.title,
    storyArc: contextResult.data.story.storyArc,
    characterName: contextResult.data.characterName,
    characterProfileSummary: contextResult.data.characterProfileSummary,
    stylePreset: contextResult.data.stylePreset,
    storyboardCoverReferenceUrl: contextResult.data.storyboardCoverUrl,
    characterReferenceUrl: contextResult.data.selectedImageUrl,
  });
  const prompt = input.promptOverride?.trim() || generatedPrompt;

  const requestPayload =
    {
      ...(input.requestPayloadOverride ??
        buildFinalPageRequestPayload({
          prompt,
          storyboardReferenceUrl: contextResult.data.storyboardCoverUrl,
          characterReferenceUrl: contextResult.data.selectedImageUrl,
        })),
      // Always force dual references for cover generation.
      image: [contextResult.data.storyboardCoverUrl, contextResult.data.selectedImageUrl],
    };
  if (!hasDualReferenceImages(requestPayload)) {
    return {
      success: false,
      error:
        "Final cover generation requires both storyboard and character reference images.",
    };
  }

  const promptId = newId();
  await db.insert(schema.promptArtifacts).values({
    id: promptId,
    entityType: "final_cover_image",
    entityId: input.storyId,
    rawPrompt: requestPayload.prompt,
    model: MODELS.nanoBanana,
    parameters: requestPayload,
    structuredFields: JSON.stringify({
      characterId: contextResult.data.characterId,
      characterName: contextResult.data.characterName,
    }),
    status: "running",
    createdAt: new Date(),
  });

  try {
    const prediction = await createPrediction(MODELS.nanoBanana, requestPayload);
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
      throw new Error("Replicate did not return an image URL for final cover");
    }

    const assetId = newId();
    const storageUrl = await copyFromTempUrl(
      tempUrl,
      `stories/${input.storyId}/cover/final/${assetId}.png`
    );

    await db.insert(schema.generatedAssets).values({
      id: assetId,
      type: "final_cover_image",
      entityId: input.storyId,
      storageUrl,
      mimeType: "image/png",
      metadata: JSON.stringify({
        promptId,
        characterId: contextResult.data.characterId,
        characterName: contextResult.data.characterName,
      }),
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
        errorMessage: error instanceof Error ? error.message : "Final cover generation failed",
      })
      .where(eq(schema.promptArtifacts.id, promptId));
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate final cover",
    };
  }
}

export async function generateFinalCoverAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = finalCoverSchema.parse({
    storyId: formData.get("storyId"),
    promptOverride: formData.get("promptOverride"),
    characterId: formData.get("characterId"),
  });
  const result = await generateSingleFinalCover({
    storyId: payload.storyId,
    promptOverride: payload.promptOverride ?? null,
    characterIdOverride: payload.characterId ?? null,
  });
  revalidatePath(`/admin/stories/${payload.storyId}/pages`);
  revalidatePath(`/admin/stories/${payload.storyId}/storyboard`);
  revalidatePath(`/admin/books/${payload.storyId}`);
  return result;
}

export async function generateFinalCoverFromRunAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = finalCoverFromRunSchema.parse({
    storyId: formData.get("storyId"),
    runArtifactId: formData.get("runArtifactId"),
    characterId: formData.get("characterId"),
  });

  const artifactRows = await db
    .select()
    .from(schema.promptArtifacts)
    .where(eq(schema.promptArtifacts.id, payload.runArtifactId))
    .limit(1);
  const artifact = artifactRows[0];
  if (!artifact) return { success: false, error: "Run artifact not found" };
  if (artifact.entityType !== "final_cover_image") {
    return { success: false, error: "Invalid run artifact type" };
  }
  if (artifact.entityId !== payload.storyId) {
    return { success: false, error: "Run artifact does not belong to this story" };
  }

  const parsedPayload = parseRequestPayload(artifact.parameters);
  if (!parsedPayload) {
    return { success: false, error: "Run artifact payload is missing or invalid" };
  }

  const result = await generateSingleFinalCover({
    storyId: payload.storyId,
    characterIdOverride: payload.characterId ?? null,
    requestPayloadOverride: parsedPayload,
  });
  revalidatePath(`/admin/stories/${payload.storyId}/pages`);
  revalidatePath(`/admin/stories/${payload.storyId}/storyboard`);
  revalidatePath(`/admin/books/${payload.storyId}`);
  return result;
}

export async function saveFinalCoverPromptDraftAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const payload = finalCoverPromptDraftSchema.parse({
    storyId: formData.get("storyId"),
    promptOverride: formData.get("promptOverride"),
    characterId: formData.get("characterId"),
  });

  const contextResult = await buildFinalCoverGenerationContext({
    storyId: payload.storyId,
    characterIdOverride: payload.characterId ?? null,
  });
  if (!contextResult.success) {
    return { success: false, error: contextResult.error };
  }

  const requestPayload = buildFinalPageRequestPayload({
    prompt: payload.promptOverride.trim(),
    storyboardReferenceUrl: contextResult.data.storyboardCoverUrl,
    characterReferenceUrl: contextResult.data.selectedImageUrl,
  });

  await db.insert(schema.promptArtifacts).values({
    id: newId(),
    entityType: "final_cover_prompt_draft",
    entityId: payload.storyId,
    rawPrompt: payload.promptOverride.trim(),
    model: MODELS.nanoBanana,
    parameters: requestPayload,
    structuredFields: JSON.stringify({
      characterId: contextResult.data.characterId,
      characterName: contextResult.data.characterName,
    }),
    status: "success",
    createdAt: new Date(),
  });

  revalidatePath(`/admin/stories/${payload.storyId}/pages`);
  revalidatePath(`/admin/stories/${payload.storyId}/storyboard`);
  return { success: true, data: { id: payload.storyId } };
}
