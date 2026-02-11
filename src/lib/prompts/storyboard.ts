import { z } from "zod";

export const STORYBOARD_ASPECT_RATIO = "4:3";

export type StoryboardPropRef = {
  title: string;
  description: string;
};

function sanitizePromptText(value?: string | null): string {
  if (!value) return "";
  return value
    .replace(/\{\{\s*name\s*\}\}/gi, "the child")
    .replace(/book format target:[^.]*\./gi, "")
    .replace(/11\s*x\s*8(?:[.,]5|[.,]4)?\s*in(?:ches)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildStoryboardCompositionPrompt(input: {
  sceneNumber: number;
  sceneDescription?: string | null;
  linkedProps: StoryboardPropRef[];
}) {
  const propsText =
    input.linkedProps.length > 0
      ? input.linkedProps
          .map(
            (prop) =>
              `${sanitizePromptText(prop.title)}: ${sanitizePromptText(prop.description)}`,
          )
          .join(" | ")
      : "none";

  return {
    systemPrompt: [
      "You are creating storyboard composition metadata for a children's book panel.",
      "Return valid JSON only.",
      "Use fields: background, foreground, environment, characterPose, composition, propsUsed.",
      "The protagonist is a white outline placeholder silhouette only.",
      "Do not add color rendering directions; this is a black-and-white storyboard phase.",
      "propsUsed should include only props present in this scene.",
    ].join(" "),
    userPrompt: [
      `Scene number: ${input.sceneNumber}.`,
      `Scene description: ${sanitizePromptText(input.sceneDescription)}.`,
      `Linked props: ${propsText}.`,
    ].join("\n"),
  };
}

export function getStoryboardOutlineReferenceUrl(): string | null {
  const explicit = process.env.OUTLINE_IMAGE_URL?.trim();
  if (explicit) return explicit;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return null;
  return `${appUrl.replace(/\/$/, "")}/outline.png`;
}

export function buildStoryboardPanelPrompt(input: {
  sceneNumber: number;
  background?: string | null;
  foreground?: string | null;
  environment?: string | null;
  characterPose?: string | null;
  composition?: string | null;
  linkedProps: StoryboardPropRef[];
  outlineReferenceUrl?: string | null;
}) {
  const propsText =
    input.linkedProps.length > 0
      ? input.linkedProps
          .map(
            (prop) =>
              `${sanitizePromptText(prop.title)}: ${sanitizePromptText(prop.description)}`,
          )
          .join(" | ")
      : "none";

  return [
    "Storyboard panel sketch for a children's picture book.",
    "",
    "Style",
    "- loose line art",
    "- black-and-white only",
    "- minimal detail",
    "- rough draft quality",
    "- no color fills",
    "- no text or captions",
    "- no logos or branding",
    "- no borders or frames",
    "",
    "Composition",
    `- background: ${sanitizePromptText(input.background) || "none"}`,
    `- foreground: ${sanitizePromptText(input.foreground) || "none"}`,
    `- environment: ${sanitizePromptText(input.environment) || "none"}`,
    `- character pose: ${sanitizePromptText(input.characterPose) || "none"}`,
    `- camera/composition: ${sanitizePromptText(input.composition) || "none"}`,
    `- props in frame: ${propsText}`,
    "",
    "Character rule",
    "- main character must remain a white outline placeholder silhouette (to be personalized later)",
  ].join("\n");
}

const rawStoryboardCompositionSchema = z
  .object({
    background: z.string().min(1).optional(),
    foreground: z.string().min(1).optional(),
    environment: z.string().min(1).optional(),
    characterPose: z.string().min(1).optional(),
    character_pose: z.string().min(1).optional(),
    composition: z.string().min(1).optional(),
    propsUsed: z.array(z.string()).optional(),
    props_used: z.array(z.string()).optional(),
  })
  .transform((value) => ({
    background: value.background ?? "",
    foreground: value.foreground ?? "",
    environment: value.environment ?? "",
    characterPose: value.characterPose ?? value.character_pose ?? "",
    composition: value.composition ?? "",
    propsUsed: value.propsUsed ?? value.props_used ?? [],
  }));

export const storyboardCompositionSchema = z.object({
  background: z.string(),
  foreground: z.string(),
  environment: z.string(),
  characterPose: z.string(),
  composition: z.string(),
  propsUsed: z.array(z.string()),
});

export type StoryboardComposition = z.infer<typeof storyboardCompositionSchema>;

export function parseAndValidateStoryboardComposition(
  raw: string,
): StoryboardComposition {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned) as unknown;
  return storyboardCompositionSchema.parse(
    rawStoryboardCompositionSchema.parse(parsed),
  );
}
