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

export async function regenerateCharacterFromModeAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const stylePreset = String(formData.get("stylePreset") ?? "");
  const mode = String(formData.get("mode") ?? "");

  const rows = await db
    .select()
    .from(schema.characters)
    .where(eq(schema.characters.id, id))
    .limit(1);

  if (!rows[0]) {
    return;
  }

  const character = rows[0];
  if (!character.sourceImageUrl) {
    return;
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
      stylePreset:
        stylePreset && stylePreset !== "default"
          ? stylePreset
          : character.stylePreset ?? "storybook",
      useExistingProfile: mode === "profile",
    },
  });

  revalidatePath(`/admin/characters/${id}`);
}

const profileUpdateSchema = z.object({
  approxAge: z.string().optional().nullable(),
  hairColor: z.string().optional().nullable(),
  hairLength: z.string().optional().nullable(),
  hairTexture: z.string().optional().nullable(),
  hairStyle: z.string().optional().nullable(),
  faceShape: z.string().optional().nullable(),
  eyeColor: z.string().optional().nullable(),
  eyeShape: z.string().optional().nullable(),
  skinTone: z.string().optional().nullable(),
  clothing: z.string().optional().nullable(),
  distinctiveFeatures: z.string().optional().nullable(),
  colorPalette: z.string().optional().nullable(),
  personalityTraits: z.string().optional().nullable(),
  doNotChange: z.string().optional().nullable(),
});

function splitList(value: string | null | undefined) {
  if (!value) return null;
  const parts = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length ? JSON.stringify(parts) : null;
}

export async function updateCharacterProfileAction(
  id: string,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = profileUpdateSchema.parse({
      approxAge: formData.get("approxAge"),
      hairColor: formData.get("hairColor"),
      hairLength: formData.get("hairLength"),
      hairTexture: formData.get("hairTexture"),
      hairStyle: formData.get("hairStyle"),
      faceShape: formData.get("faceShape"),
      eyeColor: formData.get("eyeColor"),
      eyeShape: formData.get("eyeShape"),
      skinTone: formData.get("skinTone"),
      clothing: formData.get("clothing"),
      distinctiveFeatures: formData.get("distinctiveFeatures"),
      colorPalette: formData.get("colorPalette"),
      personalityTraits: formData.get("personalityTraits"),
      doNotChange: formData.get("doNotChange"),
    });

    await db
      .insert(schema.characterProfiles)
      .values({
        id: crypto.randomUUID(),
        characterId: id,
        approxAge: parsed.approxAge ?? null,
        hairColor: parsed.hairColor ?? null,
        hairLength: parsed.hairLength ?? null,
        hairTexture: parsed.hairTexture ?? null,
        hairStyle: parsed.hairStyle ?? null,
        faceShape: parsed.faceShape ?? null,
        eyeColor: parsed.eyeColor ?? null,
        eyeShape: parsed.eyeShape ?? null,
        skinTone: parsed.skinTone ?? null,
        clothing: parsed.clothing ?? null,
        distinctiveFeatures: parsed.distinctiveFeatures ?? null,
        colorPalette: splitList(parsed.colorPalette),
        personalityTraits: splitList(parsed.personalityTraits),
        doNotChange: splitList(parsed.doNotChange),
      })
      .onConflictDoUpdate({
        target: schema.characterProfiles.characterId,
        set: {
          approxAge: parsed.approxAge ?? null,
          hairColor: parsed.hairColor ?? null,
          hairLength: parsed.hairLength ?? null,
          hairTexture: parsed.hairTexture ?? null,
          hairStyle: parsed.hairStyle ?? null,
          faceShape: parsed.faceShape ?? null,
          eyeColor: parsed.eyeColor ?? null,
          eyeShape: parsed.eyeShape ?? null,
          skinTone: parsed.skinTone ?? null,
          clothing: parsed.clothing ?? null,
          distinctiveFeatures: parsed.distinctiveFeatures ?? null,
          colorPalette: splitList(parsed.colorPalette),
          personalityTraits: splitList(parsed.personalityTraits),
          doNotChange: splitList(parsed.doNotChange),
        },
      });

    revalidatePath(`/admin/characters/${id}`);
    return { success: true, data: { id } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update profile";
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
