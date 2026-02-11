export function getOutlineReferenceUrl(): string | null {
  const explicit = process.env.OUTLINE_IMAGE_URL?.trim();
  if (explicit) return explicit;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return null;
  return `${appUrl.replace(/\/$/, "")}/outline.png`;
}

export function buildStoryCoverPrompt(input: {
  title?: string | null;
  storyArc?: string | null;
  sceneSummary?: string | null;
  propsSummary?: string | null;
  outlineReferenceUrl?: string | null;
}): string {
  return [
    "Children's picture book draft cover template illustration.",
    `Title text area at top: ${input.title ?? "Untitled Story"}.`,
    `Core story arc: ${input.storyArc ?? "adventure and emotional growth"}.`,
    "Main character shown as a white outline placeholder silhouette (to be personalized later).",
    "Style requirements: loose storyboard sketch, black-and-white only, very simple forms, minimal detail.",
    "Use rough line work and no color fills.",
    "Clear foreground, midground, and background depth.",
    input.sceneSummary ? `Scene cues: ${input.sceneSummary}.` : null,
    input.propsSummary
      ? `Important props/environments: ${input.propsSummary}.`
      : null,
    "No typography rendered in image; leave clean space for title text.",
    input.outlineReferenceUrl
      ? `Use this character outline reference as guide: ${input.outlineReferenceUrl}.`
      : "Use an outline-style hero placeholder similar to public/outline.png.",
  ]
    .filter(Boolean)
    .join(" ");
}
