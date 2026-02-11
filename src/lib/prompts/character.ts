export type CharacterProfileInput = {
  approxAge?: string | null;
  hairColor?: string | null;
  hairLength?: string | null;
  hairTexture?: string | null;
  hairStyle?: string | null;
  faceShape?: string | null;
  eyeColor?: string | null;
  eyeShape?: string | null;
  skinTone?: string | null;
  clothing?: string | null;
  distinctiveFeatures?: string | null;
  colorPalette?: string[] | null;
  personalityTraits?: string[] | null;
  doNotChange?: string[] | null;
};

export type CharacterStylePreset =
  | "watercolor"
  | "storybook"
  | "anime"
  | "flat"
  | "colored-pencil";

const STYLE_TOKENS: Record<CharacterStylePreset, string> = {
  watercolor: "soft watercolor wash, subtle paper grain, gentle edges",
  storybook: "storybook classic, warm tones, soft shading, hand-inked outlines",
  anime: "anime clean lines, bright eyes, cel shading, crisp highlights",
  flat: "flat illustration, bold shapes, minimal shading, clean blocks",
  "colored-pencil":
    "colored pencil texture, visible strokes, soft gradients, paper texture",
};

function joinList(values?: Array<string | null> | null): string | null {
  if (!values || values.length === 0) return null;
  const filtered = values.map((value) => value?.trim()).filter(Boolean);
  return filtered.length ? filtered.join(", ") : null;
}

export function buildCharacterPrompt(
  profile: CharacterProfileInput,
  style: CharacterStylePreset
): string {
  const traits = joinList(profile.personalityTraits);
  const palette = joinList(profile.colorPalette);
  const invariants = joinList(profile.doNotChange);

  const description = [
    profile.approxAge && `age: ${profile.approxAge}`,
    profile.hairColor && `hair color: ${profile.hairColor}`,
    profile.hairLength && `hair length: ${profile.hairLength}`,
    profile.hairTexture && `hair texture: ${profile.hairTexture}`,
    profile.hairStyle && `hair style: ${profile.hairStyle}`,
    profile.faceShape && `face shape: ${profile.faceShape}`,
    profile.eyeColor && `eye color: ${profile.eyeColor}`,
    profile.eyeShape && `eye shape: ${profile.eyeShape}`,
    profile.skinTone && `skin tone: ${profile.skinTone}`,
    profile.clothing && `clothing: ${profile.clothing}`,
    profile.distinctiveFeatures &&
      `distinctive features: ${profile.distinctiveFeatures}`,
    traits && `personality: ${traits}`,
    palette && `color palette: ${palette}`,
  ]
    .filter(Boolean)
    .join("; ");

  const keep = invariants ? `do not change: ${invariants}` : null;

  return [
    "Children's storybook character, full body, friendly expression",
    description,
    keep,
    STYLE_TOKENS[style],
  ]
    .filter(Boolean)
    .join(" | ");
}

export function getStylePresets(): Array<{
  value: CharacterStylePreset;
  label: string;
}> {
  return [
    { value: "watercolor", label: "Watercolor" },
    { value: "storybook", label: "Storybook Classic" },
    { value: "anime", label: "Anime/Manga" },
    { value: "flat", label: "Flat Illustration" },
    { value: "colored-pencil", label: "Colored Pencil" },
  ];
}

export const characterStyleTokens = STYLE_TOKENS;
