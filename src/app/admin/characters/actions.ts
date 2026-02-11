"use server";

import { z } from "zod";
import { db, schema } from "@/db";
import { inngest } from "@/inngest/client";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ActionResult<T> =
  | { success: true; data: T; warning?: string }
  | { success: false; error: string };

const createCharacterSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  gender: z.string().min(1, "Gender is required"),
  stylePreset: z.string().optional(),
  sourceImageUrl: z.string().url("Image URL must be valid"),
});

export async function createCharacterAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createCharacterSchema.parse({
      id: formData.get("id"),
      userId: formData.get("userId"),
      name: formData.get("name"),
      gender: formData.get("gender"),
      stylePreset: formData.get("stylePreset"),
      sourceImageUrl: formData.get("sourceImageUrl"),
    });

    const id = parsed.id ?? crypto.randomUUID();
    const normalizedUserId =
      parsed.userId && parsed.userId !== "anonymous" ? parsed.userId : null;

    await db.insert(schema.characters).values({
      id,
      userId: normalizedUserId,
      name: parsed.name,
      gender: parsed.gender,
      stylePreset: parsed.stylePreset ?? null,
      sourceImageUrl: parsed.sourceImageUrl,
      status: "generating",
    });

    let warning: string | undefined;
    try {
      await inngest.send({
        name: "character/created",
        data: {
          id,
          sourceImageUrl: parsed.sourceImageUrl,
          stylePreset: parsed.stylePreset ?? "storybook",
        },
      });
    } catch (sendError) {
      warning =
        sendError instanceof Error
          ? sendError.message
          : "Failed to send Inngest event";
    }

    return { success: true, data: { id }, warning };
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.errors.map((issue) => issue.message).join(", ")
        : "Failed to create character";
    return { success: false, error: message };
  }
}

export async function regenerateCharacterAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const rows = await db
      .select()
      .from(schema.characters)
      .where(eq(schema.characters.id, id))
      .limit(1);

    if (!rows[0]) {
      return { success: false, error: "Character not found" };
    }

    const character = rows[0];
    if (!character.sourceImageUrl) {
      return { success: false, error: "Missing source image URL" };
    }

    await db
      .update(schema.characters)
      .set({ status: "generating" })
      .where(eq(schema.characters.id, id));

    await inngest.send({
      name: "character/created",
      data: {
        id,
        sourceImageUrl: character.sourceImageUrl,
        stylePreset: character.stylePreset ?? "storybook",
      },
    });

    revalidatePath(`/admin/characters/${id}`);
    return { success: true, data: { id } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to regenerate";
    return { success: false, error: message };
  }
}

export async function deleteCharacterAction(id: string) {
  await db
    .delete(schema.characterImages)
    .where(eq(schema.characterImages.characterId, id));
  await db
    .delete(schema.characterProfiles)
    .where(eq(schema.characterProfiles.characterId, id));
  await db
    .delete(schema.promptArtifacts)
    .where(eq(schema.promptArtifacts.entityId, id));
  await db.delete(schema.generatedAssets).where(eq(schema.generatedAssets.entityId, id));
  await db.delete(schema.characters).where(eq(schema.characters.id, id));

  revalidatePath("/admin/characters");
  redirect("/admin/characters");
}

export async function selectCharacterImageAction(
  characterId: string,
  imageId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    await db
      .update(schema.characterImages)
      .set({ isSelected: false })
      .where(eq(schema.characterImages.characterId, characterId));

    await db
      .update(schema.characterImages)
      .set({ isSelected: true })
      .where(eq(schema.characterImages.id, imageId));

    revalidatePath(`/admin/characters/${characterId}`);
    return { success: true, data: { id: imageId } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to select image";
    return { success: false, error: message };
  }
}
