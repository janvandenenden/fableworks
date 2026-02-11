export function buildFinalCoverPrompt(input: {
  title: string | null;
  storyArc: string | null;
  characterName: string;
  characterProfileSummary: string;
  stylePreset: string | null;
  storyboardCoverReferenceUrl: string;
  characterReferenceUrl: string;
}): string {
  return [
    "Create a polished children-book front cover illustration.",
    `Title context: ${input.title?.trim() || "Untitled Story"}`,
    `Story arc context: ${input.storyArc?.trim() || "none"}`,
    `Character name: ${input.characterName}`,
    `Character profile: ${input.characterProfileSummary || "none"}`,
    `Style preset: ${input.stylePreset || "storybook"}`,
    `Storyboard cover reference image URL: ${input.storyboardCoverReferenceUrl}`,
    `Character reference image URL: ${input.characterReferenceUrl}`,
    "Requirements:",
    "- keep the cover composition faithful to the storyboard cover sketch",
    "- keep the character identity faithful to character reference",
    "- cinematic, colorful, print-ready finish",
    "- no text, letters, logos, watermark, signatures, frame, or border",
    "- no collage layout",
  ].join("\n");
}
