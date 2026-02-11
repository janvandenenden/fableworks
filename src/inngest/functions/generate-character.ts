import { z } from "zod";
import { inngest } from "@/inngest/client";
import { db, schema } from "@/db";
import { analyzeImage } from "@/lib/openai";
import { buildCharacterPrompt } from "@/lib/prompts/character";
import { MODELS, extractImageUrl, runPrediction } from "@/lib/replicate";
import { copyFromTempUrl } from "@/lib/r2";

const characterCreatedSchema = z.object({
  id: z.string(),
  sourceImageUrl: z.string().url(),
  stylePreset: z.string().optional(),
});

const visionProfileSchema = z.object({
  approxAge: z.string().nullish(),
  hairColor: z.string().nullish(),
  hairLength: z.string().nullish(),
  hairTexture: z.string().nullish(),
  hairStyle: z.string().nullish(),
  faceShape: z.string().nullish(),
  eyeColor: z.string().nullish(),
  eyeShape: z.string().nullish(),
  skinTone: z.string().nullish(),
  clothing: z.string().nullish(),
  distinctiveFeatures: z.string().nullish(),
  colorPalette: z.array(z.string()).nullish(),
  personalityTraits: z.array(z.string()).nullish(),
  doNotChange: z.array(z.string()).nullish(),
  rawVisionDescription: z.string().nullish(),
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
        .where((row, { eq }) => eq(row.id, payload.id))
    );

    const visionPrompt = [
      "Analyze the child photo for a storybook illustration profile.",
      "Return JSON only with keys:",
      "approxAge, hairColor, hairLength, hairTexture, hairStyle, faceShape,",
      "eyeColor, eyeShape, skinTone, clothing, distinctiveFeatures,",
      "colorPalette (string[]), personalityTraits (string[]),",
      "doNotChange (string[]), rawVisionDescription (string).",
    ].join(" ");

    const visionResponse = await step.run("vision-profile", () =>
      analyzeImage(payload.sourceImageUrl, visionPrompt, {
        model: "gpt-4o",
        maxTokens: 1024,
      })
    );

    let parsedProfile: z.infer<typeof visionProfileSchema>;
    try {
      parsedProfile = visionProfileSchema.parse(JSON.parse(visionResponse));
    } catch (error) {
      await step.run("mark-prompt-failed", () =>
        db
          .update(schema.characters)
          .set({ status: "draft" })
          .where((row, { eq }) => eq(row.id, payload.id))
      );
      throw error;
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

    await step.run("store-profile", () =>
      db.insert(schema.characterProfiles).values({
        id: newId(),
        characterId: payload.id,
        ...normalizedProfile,
      })
    );

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

    const predictionOutput = await step.run("replicate-generate", () =>
      runPrediction(MODELS.nanoBanana, {
        prompt,
        image: payload.sourceImageUrl,
      })
    );

    const tempUrl = extractImageUrl(predictionOutput);
    if (!tempUrl) {
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
        .where((row, { eq }) => eq(row.id, payload.id))
    );

    await step.run("mark-prompt-success", () =>
      db
        .update(schema.promptArtifacts)
        .set({ status: "success", resultUrl: imageUrl })
        .where((row, { eq }) => eq(row.id, promptId))
    );

    return { imageUrl };
  }
);
