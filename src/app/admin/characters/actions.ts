"use server";

import { z } from "zod";
import { db, schema } from "@/db";
import { inngest } from "@/inngest/client";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const createCharacterSchema = z.object({
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
      name: formData.get("name"),
      gender: formData.get("gender"),
      stylePreset: formData.get("stylePreset"),
      sourceImageUrl: formData.get("sourceImageUrl"),
    });

    const id = crypto.randomUUID();

    await db.insert(schema.characters).values({
      id,
      name: parsed.name,
      gender: parsed.gender,
      stylePreset: parsed.stylePreset ?? null,
      sourceImageUrl: parsed.sourceImageUrl,
      status: "draft",
    });

    await inngest.send({
      name: "character/created",
      data: {
        id,
        sourceImageUrl: parsed.sourceImageUrl,
        stylePreset: parsed.stylePreset ?? "storybook",
      },
    });

    return { success: true, data: { id } };
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.errors.map((issue) => issue.message).join(", ")
        : "Failed to create character";
    return { success: false, error: message };
  }
}
