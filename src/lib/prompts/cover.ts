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
    "Storyboard draft cover sketch for a children's picture book.",
    "",
    "Style",
    "- loose line art",
    "- black-and-white only",
    "- minimal detail",
    "- rough draft quality",
    "- no color fills",
    "- no painterly shading",
    "- no polished rendering",
    "",
    "Cover focus",
    `- title placeholder area at top: ${input.title ?? "Untitled Story"}`,
    `- core story arc: ${input.storyArc ?? "adventure and emotional growth"}`,
    "- clear foreground, midground, and background depth",
    "- no rendered typography; keep clean space for title text",
    "",
    "Story context",
    input.sceneSummary ? `- scene cues: ${input.sceneSummary}` : "- scene cues: none",
    input.propsSummary
      ? `- important props/environments: ${input.propsSummary}`
      : "- important props/environments: none",
    "",
    "Character rule",
    "- main character must remain a white outline placeholder silhouette (to be personalized later)",
    "- reference outline image is provided separately as model input",
  ].join("\n");
}
