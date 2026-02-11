import { z } from "zod";

export const storyAgeRanges = ["3-5", "6-8", "9-12"] as const;
export type StoryAgeRange = (typeof storyAgeRanges)[number];

export type StoryIntakeInput = {
  ageRange: StoryAgeRange;
  theme?: string | null;
};

export function getStorySpreadTarget(ageRange: StoryAgeRange): number {
  const targetByAgeRange: Record<StoryAgeRange, number> = {
    "3-5": 12,
    "6-8": 14,
    "9-12": 16,
  };
  return targetByAgeRange[ageRange];
}

function normalizeTheme(theme?: string | null): string | null {
  if (!theme) return null;
  const trimmed = theme.trim();
  return trimmed.length ? trimmed : null;
}

export function buildStoryConceptPrompts(input: StoryIntakeInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const safeTheme = normalizeTheme(input.theme);

  return {
    systemPrompt: [
      "You are an experienced children's picture-book author.",
      "Return valid JSON only. Do not wrap JSON in markdown.",
      "Protagonist must remain a placeholder: {{name}}.",
      "Prefer neutral phrasing to avoid hardcoding pronouns; this story is personalized later.",
      "Generate a concept brief with fields: emotionalCore, visualHook, toneTexture, lessonThread.",
    ].join(" "),
    userPrompt: [
      `Target age range: ${input.ageRange}.`,
      safeTheme ? `Theme or lesson seed: ${safeTheme}.` : "Theme or lesson seed: none.",
      "Write one clear concept that can support a full picture-book arc.",
    ].join(" "),
  };
}

export function buildStoryManuscriptPrompts(input: StoryIntakeInput & { conceptJson: string }): {
  systemPrompt: string;
  userPrompt: string;
} {
  const safeTheme = normalizeTheme(input.theme);

  return {
    systemPrompt: [
      "You are drafting manuscript metadata for a children's picture book.",
      "Return valid JSON only. Do not use markdown.",
      "Use {{name}} placeholder if you reference protagonist by name.",
      "Avoid hardcoded gender pronouns where possible.",
      "Return exactly: title, arc_summary.",
      "Title should be specific and child-friendly.",
      "Arc summary should be 2-4 sentences.",
    ].join(" "),
    userPrompt: [
      `Target age range: ${input.ageRange}.`,
      safeTheme ? `Theme or lesson: ${safeTheme}.` : "Theme or lesson: none.",
      `Concept JSON: ${input.conceptJson}`,
    ].join(" "),
  };
}

export function buildStoryScenesPrompts(input: StoryIntakeInput & {
  conceptJson: string;
  manuscriptJson: string;
}): { systemPrompt: string; userPrompt: string } {
  const safeTheme = normalizeTheme(input.theme);
  const spreadTarget = getStorySpreadTarget(input.ageRange);

  return {
    systemPrompt: [
      "You are writing final scene-level spreads for a children's picture book manuscript.",
      "Return valid JSON only. Do not use markdown.",
      "Use {{name}} as protagonist placeholder.",
      "Avoid hardcoded gender pronouns where possible.",
      `Generate at least 12 scenes, target ${spreadTarget} scenes.`,
      "Each scene must include: scene_number, spread_text, scene_description.",
      "Top-level JSON must include: scenes.",
    ].join(" "),
    userPrompt: [
      `Target age range: ${input.ageRange}.`,
      safeTheme ? `Theme or lesson: ${safeTheme}.` : "Theme or lesson: none.",
      `Concept JSON: ${input.conceptJson}`,
      `Manuscript JSON: ${input.manuscriptJson}`,
    ].join(" "),
  };
}

export function buildSceneRegenerationPrompts(input: {
  ageRange: StoryAgeRange;
  sceneNumber: number;
  fullStoryContext: string;
  currentSceneText: string;
  theme?: string | null;
}): {
  systemPrompt: string;
  userPrompt: string;
} {
  const safeTheme = normalizeTheme(input.theme);

  return {
    systemPrompt: [
      "You are revising a single scene from a children's picture-book manuscript.",
      "Return valid JSON only with: spread_text, scene_description.",
      "Keep tone and continuity aligned with the full story context.",
      "Use {{name}} placeholder and avoid hardcoded gender pronouns where possible.",
    ].join(" "),
    userPrompt: [
      `Age range: ${input.ageRange}.`,
      `Scene number to revise: ${input.sceneNumber}.`,
      safeTheme ? `Theme or lesson: ${safeTheme}.` : "Theme or lesson: none.",
      `Full story context: ${input.fullStoryContext}.`,
      `Current scene text: ${input.currentSceneText}.`,
    ].join(" "),
  };
}

export function cleanJsonResponse(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export function parseModelJson<T>(raw: string): T {
  return JSON.parse(cleanJsonResponse(raw)) as T;
}

export const storyConceptSchema = z.object({
  emotionalCore: z.string().min(1),
  visualHook: z.string().min(1),
  toneTexture: z.string().min(1),
  lessonThread: z.string().min(1),
});

export const storyManuscriptSchema = z.object({
  title: z.string().min(1),
  arcSummary: z.string().min(1),
});

const rawManuscriptSchema = z
  .object({
    title: z.string().min(1),
    arcSummary: z.string().min(1).optional(),
    arc_summary: z.string().min(1).optional(),
  })
  .transform((value) => ({
    title: value.title,
    arcSummary: value.arcSummary ?? value.arc_summary ?? "",
  }));

const rawSceneSchema = z
  .object({
    sceneNumber: z.number().int().positive().optional(),
    scene_number: z.number().int().positive().optional(),
    spreadText: z.string().min(1).optional(),
    spread_text: z.string().min(1).optional(),
    sceneDescription: z.string().min(1).optional(),
    scene_description: z.string().min(1).optional(),
  })
  .transform((value) => {
    const sceneNumber = value.sceneNumber ?? value.scene_number;
    const spreadText = value.spreadText ?? value.spread_text;
    const sceneDescription = value.sceneDescription ?? value.scene_description;
    return {
      sceneNumber,
      spreadText,
      sceneDescription,
    };
  })
  .refine(
    (value) => !!value.sceneNumber && !!value.spreadText && !!value.sceneDescription,
    "Scene is missing required fields"
  );

export const storySceneSchema = z.object({
  sceneNumber: z.number().int().positive(),
  spreadText: z.string().min(1),
  sceneDescription: z.string().min(1),
});

const rawScenesOutputSchema = z
  .object({
    scenes: z.array(rawSceneSchema).min(12),
  })
  .transform((value) => value.scenes);

export const storyScenesSchema = z.array(storySceneSchema).min(12);

export type StoryScene = z.infer<typeof storySceneSchema>;
export type StoryManuscript = z.infer<typeof storyManuscriptSchema>;
export type StoryConcept = z.infer<typeof storyConceptSchema>;
export type StoryScenes = z.infer<typeof storyScenesSchema>;

export function parseAndValidateStoryConcept(raw: string): StoryConcept {
  return storyConceptSchema.parse(parseModelJson<unknown>(raw));
}

export function parseAndValidateStoryOutput(raw: string): StoryScenes {
  const parsed = parseModelJson<unknown>(raw);
  return storyScenesSchema.parse(rawScenesOutputSchema.parse(parsed));
}

export function parseAndValidateStoryManuscript(raw: string): StoryManuscript {
  const parsed = parseModelJson<unknown>(raw);
  return storyManuscriptSchema.parse(rawManuscriptSchema.parse(parsed));
}

export function parseAndValidateStoryScene(raw: string): StoryScene {
  const parsed = parseModelJson<unknown>(raw);
  return storySceneSchema.parse(rawSceneSchema.parse(parsed));
}
