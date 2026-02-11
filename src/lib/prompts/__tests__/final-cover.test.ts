import { describe, expect, it } from "vitest";
import { buildFinalCoverPrompt } from "@/lib/prompts/final-cover";

describe("final cover prompt", () => {
  it("includes storyboard + character references and safety constraints", () => {
    const prompt = buildFinalCoverPrompt({
      title: "Lantern River",
      storyArc: "A child finds courage.",
      characterName: "Ava",
      characterProfileSummary: "hair color: brown; clothing: yellow raincoat",
      stylePreset: "storybook",
      storyboardCoverReferenceUrl: "https://example.com/storyboard-cover.png",
      characterReferenceUrl: "https://example.com/char.png",
    });

    expect(prompt).toContain("storyboard cover");
    expect(prompt).toContain("Character name: Ava");
    expect(prompt).toContain("https://example.com/storyboard-cover.png");
    expect(prompt).toContain("https://example.com/char.png");
    expect(prompt).toContain("no text");
  });
});
