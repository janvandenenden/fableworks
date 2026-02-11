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

  return [
    "Final illustrated page for a children's picture book.",
    "Turn [@image1] into a scene for a children's picture book. Replace the outline with the character image from [@image2].",
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
  ].join("\n");
}

export function buildFinalPageRequestPayload(input: {
  prompt: string;
  storyboardReferenceUrl: string;
  characterReferenceUrl: string;
}) {
  return {
    prompt: input.prompt,
    aspect_ratio: FINAL_PAGE_ASPECT_RATIO,
    output_format: "png",
    image: [input.storyboardReferenceUrl, input.characterReferenceUrl],
  };
}
