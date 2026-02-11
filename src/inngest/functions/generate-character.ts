import { z } from "zod";
import { inngest } from "@/inngest/client";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { analyzeImage } from "@/lib/openai";
import { buildCharacterPrompt } from "@/lib/prompts/character";
import {
  MODELS,
  extractImageUrl,
  createPrediction,
  getReplicateClient,
} from "@/lib/replicate";
import { copyFromTempUrl } from "@/lib/r2";

const characterCreatedSchema = z.object({
  id: z.string(),
  sourceImageUrl: z.string().url(),
  stylePreset: z.string().optional(),
  useExistingProfile: z.boolean().optional(),
});

const stringish = z
  .preprocess(
    (value) =>
      value === null || value === undefined ? value : String(value),
    z.string()
  )
  .optional()
  .nullable();

const stringArray = z
  .preprocess(
    (value) =>
      Array.isArray(value) ? value.map((item) => String(item)) : value,
    z.array(z.string())
  )
  .optional()
  .nullable();

const visionProfileSchema = z.object({
  approxAge: stringish,
  hairColor: stringish,
  hairLength: stringish,
  hairTexture: stringish,
  hairStyle: stringish,
  faceShape: stringish,
  eyeColor: stringish,
  eyeShape: stringish,
  skinTone: stringish,
  clothing: stringish,
  distinctiveFeatures: stringish,
  colorPalette: stringArray,
  personalityTraits: stringArray,
  doNotChange: stringArray,
  rawVisionDescription: stringish,
});

function newId(): string {
  return crypto.randomUUID();
}

export const generateCharacter = inngest.createFunction(
  { id: "generate-character" },
  { event: "character/created" },
  async ({ event, step }) => {
    const payload = characterCreatedSchema.parse(event.data);

    await step.run("mark-generating", () =>
      db
        .update(schema.characters)
        .set({ status: "generating" })
        .where(eq(schema.characters.id, payload.id))
    );

    const visionPrompt = [
      "Analyze the child photo for a storybook illustration profile.",
      "Return JSON only with keys:",
      "approxAge, hairColor, hairLength, hairTexture, hairStyle, faceShape,",
      "eyeColor, eyeShape, skinTone, clothing, distinctiveFeatures,",
      "colorPalette (string[]), personalityTraits (string[]),",
      "doNotChange (string[]), rawVisionDescription (string).",
    ].join(" ");

    let parsedProfile: z.infer<typeof visionProfileSchema>;
    let useExistingProfile = payload.useExistingProfile ?? false;
    if (useExistingProfile) {
      const existing = await step.run("load-profile", () =>
        db
          .select()
          .from(schema.characterProfiles)
          .where(eq(schema.characterProfiles.characterId, payload.id))
          .limit(1)
      );
      if (existing[0]) {
        const row = existing[0];
        parsedProfile = visionProfileSchema.parse({
          approxAge: row.approxAge,
          hairColor: row.hairColor,
          hairLength: row.hairLength,
          hairTexture: row.hairTexture,
          hairStyle: row.hairStyle,
          faceShape: row.faceShape,
          eyeColor: row.eyeColor,
          eyeShape: row.eyeShape,
          skinTone: row.skinTone,
          clothing: row.clothing,
          distinctiveFeatures: row.distinctiveFeatures,
          colorPalette: row.colorPalette ? JSON.parse(row.colorPalette) : null,
          personalityTraits: row.personalityTraits
            ? JSON.parse(row.personalityTraits)
            : null,
          doNotChange: row.doNotChange ? JSON.parse(row.doNotChange) : null,
          rawVisionDescription: row.rawVisionDescription,
        });
      } else {
        useExistingProfile = false;
      }
    }

    if (!useExistingProfile) {
      const visionResponse = await step.run("vision-profile", () =>
        analyzeImage(payload.sourceImageUrl, visionPrompt, {
          model: "gpt-4o",
          maxTokens: 1024,
        })
      );

      try {
        const cleaned = visionResponse
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        parsedProfile = visionProfileSchema.parse(JSON.parse(cleaned));
      } catch (error) {
        await step.run("mark-prompt-failed", () =>
          db
            .update(schema.characters)
            .set({ status: "draft" })
            .where(eq(schema.characters.id, payload.id))
        );
        throw error;
      }
    }

    const normalizedProfile = {
      approxAge: parsedProfile.approxAge ?? null,
      hairColor: parsedProfile.hairColor ?? null,
      hairLength: parsedProfile.hairLength ?? null,
      hairTexture: parsedProfile.hairTexture ?? null,
      hairStyle: parsedProfile.hairStyle ?? null,
      faceShape: parsedProfile.faceShape ?? null,
      eyeColor: parsedProfile.eyeColor ?? null,
      eyeShape: parsedProfile.eyeShape ?? null,
      skinTone: parsedProfile.skinTone ?? null,
      clothing: parsedProfile.clothing ?? null,
      distinctiveFeatures: parsedProfile.distinctiveFeatures ?? null,
      colorPalette: parsedProfile.colorPalette
        ? JSON.stringify(parsedProfile.colorPalette)
        : null,
      personalityTraits: parsedProfile.personalityTraits
        ? JSON.stringify(parsedProfile.personalityTraits)
        : null,
      doNotChange: parsedProfile.doNotChange
        ? JSON.stringify(parsedProfile.doNotChange)
        : null,
      rawVisionDescription: parsedProfile.rawVisionDescription ?? null,
    };

    if (!useExistingProfile) {
      await step.run("store-profile", () =>
        db
          .insert(schema.characterProfiles)
          .values({
            id: newId(),
            characterId: payload.id,
            ...normalizedProfile,
          })
          .onConflictDoUpdate({
            target: schema.characterProfiles.characterId,
            set: normalizedProfile,
          })
      );
    }

    const stylePreset = ((): "watercolor" | "storybook" | "anime" | "flat" | "colored-pencil" => {
      const value = payload.stylePreset ?? "storybook";
      if (
        value === "watercolor" ||
        value === "storybook" ||
        value === "anime" ||
        value === "flat" ||
        value === "colored-pencil"
      ) {
        return value;
      }
      return "storybook";
    })();

    const prompt = buildCharacterPrompt(
      {
        approxAge: normalizedProfile.approxAge,
        hairColor: normalizedProfile.hairColor,
        hairLength: normalizedProfile.hairLength,
        hairTexture: normalizedProfile.hairTexture,
        hairStyle: normalizedProfile.hairStyle,
        faceShape: normalizedProfile.faceShape,
        eyeColor: normalizedProfile.eyeColor,
        eyeShape: normalizedProfile.eyeShape,
        skinTone: normalizedProfile.skinTone,
        clothing: normalizedProfile.clothing,
        distinctiveFeatures: normalizedProfile.distinctiveFeatures,
        colorPalette: parsedProfile.colorPalette ?? null,
        personalityTraits: parsedProfile.personalityTraits ?? null,
        doNotChange: parsedProfile.doNotChange ?? null,
      },
      stylePreset
    );
    const promptId = newId();

    await step.run("record-prompt", () =>
      db.insert(schema.promptArtifacts).values({
        id: promptId,
        entityType: "character",
        entityId: payload.id,
        rawPrompt: prompt,
        model: MODELS.nanoBanana,
        status: "pending",
      })
    );

    await step.run("mark-prompt-running", () =>
      db
        .update(schema.promptArtifacts)
        .set({ status: "running" })
        .where(eq(schema.promptArtifacts.id, promptId))
    );

    const prediction = await step.run("replicate-start", () =>
      createPrediction(MODELS.nanoBanana, {
        prompt,
        image: payload.sourceImageUrl,
      })
    );

    await step.run("record-prediction", () =>
      db
        .update(schema.promptArtifacts)
        .set({
          status: "running",
          parameters: JSON.stringify({ predictionId: prediction.id }),
        })
        .where(eq(schema.promptArtifacts.id, promptId))
    );

    const replicate = getReplicateClient();
    let predictionOutput: unknown = null;
    let predictionStatus = prediction.status;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const result = await step.run(`replicate-poll-${attempt + 1}`, () =>
        replicate.predictions.get(prediction.id)
      );
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
      await step.sleep(`replicate-wait-${attempt + 1}`, "5s");
    }

    if (!predictionOutput) {
      throw new Error(`Replicate prediction still ${predictionStatus}`);
    }

    const outputSnapshot = (() => {
      try {
        return JSON.stringify(predictionOutput).slice(0, 4000);
      } catch {
        return "unserializable output";
      }
    })();

    await step.run("record-output", () =>
      db
        .update(schema.promptArtifacts)
        .set({ parameters: outputSnapshot })
        .where(eq(schema.promptArtifacts.id, promptId))
    );

    const tempUrl = extractImageUrl(predictionOutput);
    if (!tempUrl) {
      await step.run("mark-prompt-failed", () =>
        db
          .update(schema.promptArtifacts)
          .set({
            status: "failed",
            errorMessage: `Replicate did not return an image URL. Output: ${outputSnapshot}`,
          })
          .where(eq(schema.promptArtifacts.id, promptId))
      );
      await step.run("mark-failed", () =>
        db
          .update(schema.characters)
          .set({ status: "draft" })
          .where(eq(schema.characters.id, payload.id))
      );
      throw new Error("Replicate did not return an image URL");
    }

    const imageId = newId();
    const imageUrl = await step.run("persist-image", () =>
      copyFromTempUrl(tempUrl, `characters/${payload.id}/${imageId}.png`)
    );

    await step.run("record-image", () =>
      db.insert(schema.characterImages).values({
        id: imageId,
        characterId: payload.id,
        imageUrl,
        promptArtifactId: promptId,
      })
    );

    await step.run("mark-ready", () =>
      db
        .update(schema.characters)
        .set({ status: "ready" })
        .where(eq(schema.characters.id, payload.id))
    );

    await step.run("mark-prompt-success", () =>
      db
        .update(schema.promptArtifacts)
        .set({ status: "success", resultUrl: imageUrl })
        .where(eq(schema.promptArtifacts.id, promptId))
    );

    return { imageUrl };
  }
);
