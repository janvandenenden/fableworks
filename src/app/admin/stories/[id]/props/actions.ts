"use server";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { generateText } from "@/lib/openai";
import {
  buildPropsExtractionPrompts,
  parseAndValidatePropsOutput,
} from "@/lib/prompts/props";
import { revalidatePath } from "next/cache";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const storyIdSchema = z.object({
  storyId: z.string().uuid(),
});

const propSchema = z.object({
  title: z.string().min(1),
  category: z.enum(["object", "environment", "element"]),
  description: z.string().min(1),
  tags: z.string().optional().nullable(),
  appearsInScenes: z.string().optional().nullable(),
});

function newId(): string {
  return crypto.randomUUID();
}

function normalizeTags(tags?: string | null): string {
  if (!tags) return JSON.stringify([]);
  const values = tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return JSON.stringify(values);
}

function normalizeScenes(value?: string | null): string {
  if (!value) return JSON.stringify([]);
  const parsed = value
    .split(",")
    .map((token) => Number.parseInt(token.trim(), 10))
    .filter((num) => Number.isFinite(num) && num > 0);
  return JSON.stringify(Array.from(new Set(parsed)).sort((a, b) => a - b));
}

export async function generatePropsBibleAction(
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

  const prompts = buildPropsExtractionPrompts({
    title: story.title,
    storyArc: story.storyArc,
    scenes: scenes.map((scene) => ({
      sceneNumber: scene.sceneNumber,
      spreadText: scene.spreadText,
      sceneDescription: scene.sceneDescription,
    })),
  });

  await db
    .update(schema.stories)
    .set({ status: "props_generating" })
    .where(eq(schema.stories.id, payload.storyId));

  try {
    const raw = await generateText(
      [
        { role: "system", content: prompts.systemPrompt },
        { role: "user", content: prompts.userPrompt },
      ],
      { model: "gpt-4o", maxTokens: 3000, temperature: 0.4 }
    );
    const props = parseAndValidatePropsOutput(raw);

    await db
      .delete(schema.propsBibleEntries)
      .where(eq(schema.propsBibleEntries.storyId, payload.storyId));

    if (props.length > 0) {
      await db.insert(schema.propsBibleEntries).values(
        props.map((prop) => ({
          id: newId(),
          storyId: payload.storyId,
          title: prop.title,
          category: prop.category,
          appearsInScenes: JSON.stringify(prop.appearsInScenes),
          description: prop.description,
          tags: JSON.stringify(prop.tags),
        }))
      );
    }

    await db.insert(schema.promptArtifacts).values({
      id: newId(),
      entityType: "story",
      entityId: payload.storyId,
      rawPrompt: `${prompts.systemPrompt}\n\n${prompts.userPrompt}`,
      model: "gpt-4o",
      status: "success",
      structuredFields: JSON.stringify({ phase: "props", propCount: props.length }),
    });

    await db
      .update(schema.stories)
      .set({ status: "props_ready" })
      .where(eq(schema.stories.id, payload.storyId));

    revalidatePath(`/admin/stories/${payload.storyId}/props`);
    revalidatePath(`/admin/stories/${payload.storyId}`);
    return { success: true, data: { id: payload.storyId } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate props bible";
    await db.insert(schema.promptArtifacts).values({
      id: newId(),
      entityType: "story",
      entityId: payload.storyId,
      rawPrompt: `${prompts.systemPrompt}\n\n${prompts.userPrompt}`,
      model: "gpt-4o",
      status: "failed",
      errorMessage: message,
      structuredFields: JSON.stringify({ phase: "props" }),
    });
    await db
      .update(schema.stories)
      .set({ status: "props_failed" })
      .where(eq(schema.stories.id, payload.storyId));
    revalidatePath(`/admin/stories/${payload.storyId}/props`);
    return { success: false, error: message };
  }
}

export async function createPropAction(
  storyId: string,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = propSchema.parse({
      title: formData.get("title"),
      category: formData.get("category"),
      description: formData.get("description"),
      tags: formData.get("tags"),
      appearsInScenes: formData.get("appearsInScenes"),
    });
    const id = newId();
    await db.insert(schema.propsBibleEntries).values({
      id,
      storyId,
      title: parsed.title,
      category: parsed.category,
      appearsInScenes: normalizeScenes(parsed.appearsInScenes),
      description: parsed.description,
      tags: normalizeTags(parsed.tags),
    });
    revalidatePath(`/admin/stories/${storyId}/props`);
    return { success: true, data: { id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create prop",
    };
  }
}

export async function updatePropAction(
  storyId: string,
  propId: string,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = propSchema.parse({
      title: formData.get("title"),
      category: formData.get("category"),
      description: formData.get("description"),
      tags: formData.get("tags"),
      appearsInScenes: formData.get("appearsInScenes"),
    });
    await db
      .update(schema.propsBibleEntries)
      .set({
        title: parsed.title,
        category: parsed.category,
        appearsInScenes: normalizeScenes(parsed.appearsInScenes),
        description: parsed.description,
        tags: normalizeTags(parsed.tags),
      })
      .where(eq(schema.propsBibleEntries.id, propId));

    revalidatePath(`/admin/stories/${storyId}/props`);
    return { success: true, data: { id: propId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update prop",
    };
  }
}

export async function deletePropAction(formData: FormData) {
  const propId = String(formData.get("propId") ?? "");
  const storyId = String(formData.get("storyId") ?? "");
  if (!propId || !storyId) return;

  await db
    .delete(schema.propImages)
    .where(eq(schema.propImages.propId, propId));
  await db
    .delete(schema.propsBibleEntries)
    .where(eq(schema.propsBibleEntries.id, propId));
  revalidatePath(`/admin/stories/${storyId}/props`);
}
