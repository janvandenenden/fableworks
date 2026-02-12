export const FINAL_PAGE_ASPECT_RATIO = "4:3";

export type FinalPagePropRef = {
  title: string;
  description: string;
};

function sanitizePromptText(value?: string | null): string {
  if (!value) return "";
  return value
    .replace(/\{\{\s*name\s*\}\}/gi, "the child")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildFinalPagePrompt(input: {
  sceneNumber: number;
  spreadText?: string | null;
  sceneDescription?: string | null;
  storyboardComposition?: string | null;
  storyboardBackground?: string | null;
  storyboardForeground?: string | null;
  storyboardEnvironment?: string | null;
  storyboardCharacterPose?: string | null;
  stylePreset?: string | null;
  colorPalette?: string[] | null;
  characterProfileSummary?: string | null;
  doNotChange?: string[] | null;
  linkedProps: FinalPagePropRef[];
  characterReferenceUrl?: string | null;
  storyboardReferenceUrl?: string | null;
}): string {
  const paletteText =
    input.colorPalette && input.colorPalette.length > 0
      ? input.colorPalette.map((value) => sanitizePromptText(value)).join(", ")
      : "none";
  const propsText =
    input.linkedProps.length > 0
      ? input.linkedProps
          .map(
            (prop) =>
              `- ${sanitizePromptText(prop.title)}: ${sanitizePromptText(prop.description)}`,
          )
          .join("\n")
      : "- none";
  const sceneLines = [
    `- scene number: ${input.sceneNumber}`,
    `- spread text: ${sanitizePromptText(input.spreadText) || "none"}`,
    `- scene description: ${sanitizePromptText(input.sceneDescription) || "none"}`,
    `- composition: ${sanitizePromptText(input.storyboardComposition) || "follow storyboard reference"}`,
    `- background: ${sanitizePromptText(input.storyboardBackground) || "follow storyboard reference"}`,
    `- foreground: ${sanitizePromptText(input.storyboardForeground) || "follow storyboard reference"}`,
    `- environment: ${sanitizePromptText(input.storyboardEnvironment) || "follow storyboard reference"}`,
    `- character pose: ${sanitizePromptText(input.storyboardCharacterPose) || "follow storyboard reference"}`,
  ].join("\n");
  const identityLines = [
    `- character profile: ${sanitizePromptText(input.characterProfileSummary) || "preserve identity from character reference image"}`,
    ...(input.doNotChange && input.doNotChange.length > 0
      ? input.doNotChange.map((value) => `- keep: ${sanitizePromptText(value)}`)
      : ["- keep: preserve identity consistency with the character reference image"]),
  ].join("\n");

  return [
    "Final illustrated page for a children's picture book.",
    "Turn [@image1] into a scene for a children's picture book. Replace the child figure with the character image from [@image2].",
    "",
    "Scene context",
    sceneLines,
    "",
    "Character identity constraints",
    identityLines,
    "",
    "Style",
    `- style preset: ${sanitizePromptText(input.stylePreset) || "storybook illustration"}`,
    `- color palette: ${paletteText}`,
    "- polished full-color rendering",
    "- keep pose natural and consistent with the rest of the scene",
    "- no text overlays, captions, watermarks, logos, or borders",
    "",
    "Props in this scene",
    propsText,
    "",
    `- storyboard reference image URL: ${sanitizePromptText(input.storyboardReferenceUrl) || "provided as image_input[0]"}`,
    `- character reference image URL: ${sanitizePromptText(input.characterReferenceUrl) || "provided as image_input[1]"}`,
    "",
  ].join("\n");
}

export function buildFinalPageRequestPayload(input: {
  prompt: string;
  storyboardReferenceUrl: string;
  characterReferenceUrl: string;
}) {
  const refs = [input.storyboardReferenceUrl, input.characterReferenceUrl];
  return {
    prompt: input.prompt,
    aspect_ratio: FINAL_PAGE_ASPECT_RATIO,
    output_format: "png",
    // NanoBanana expects `image_input` for multi-image references.
    image_input: refs,
    // Keep compatibility for older stored payload readers/tools.
    image: refs,
  };
}
