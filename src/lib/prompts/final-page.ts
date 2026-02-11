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
  const invariantsText =
    input.doNotChange && input.doNotChange.length > 0
      ? input.doNotChange.map((value) => `- keep: ${sanitizePromptText(value)}`).join("\n")
      : "- keep: preserve identity consistency with the reference image";
  const propsText =
    input.linkedProps.length > 0
      ? input.linkedProps
          .map(
            (prop) =>
              `- ${sanitizePromptText(prop.title)}: ${sanitizePromptText(prop.description)}`
          )
          .join("\n")
      : "- none";

  return [
    "Final illustrated page for a children's picture book.",
    "",
    "Style",
    `- style preset: ${sanitizePromptText(input.stylePreset) || "storybook illustration"}`,
    `- color palette: ${paletteText}`,
    "- polished full-color rendering",
    "- cohesive style matching the rest of the book",
    "- no text overlays, captions, watermarks, logos, or borders",
    "",
    "Scene",
    `- scene number: ${input.sceneNumber}`,
    `- spread text: ${sanitizePromptText(input.spreadText) || "none"}`,
    `- scene description: ${sanitizePromptText(input.sceneDescription) || "none"}`,
    "",
    "Storyboard composition constraints",
    `- camera/composition: ${sanitizePromptText(input.storyboardComposition) || "none"}`,
    `- background: ${sanitizePromptText(input.storyboardBackground) || "none"}`,
    `- foreground: ${sanitizePromptText(input.storyboardForeground) || "none"}`,
    `- environment: ${sanitizePromptText(input.storyboardEnvironment) || "none"}`,
    `- character pose/action: ${sanitizePromptText(input.storyboardCharacterPose) || "none"}`,
    "",
    "Character consistency",
    `- character profile summary: ${sanitizePromptText(input.characterProfileSummary) || "none"}`,
    invariantsText,
    `- character reference image URL: ${sanitizePromptText(input.characterReferenceUrl) || "none"}`,
    "- do not output placeholder silhouette",
    "",
    "Props in this scene",
    propsText,
    "",
    "References",
    `- storyboard reference image URL: ${sanitizePromptText(input.storyboardReferenceUrl) || "none"}`,
    "",
    "Quality constraints",
    "- avoid age drift, facial-feature drift, and outfit drift",
    "- keep composition faithful to storyboard structure",
    "- keep child identity stable across all pages",
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
