import { describe, expect, it } from "vitest";
import {
  buildStoryboardCompositionPrompt,
  buildStoryboardPanelPrompt,
  parseAndValidateStoryboardComposition,
} from "@/lib/prompts/storyboard";

describe("storyboard prompts", () => {
  it("builds composition prompt with scene and linked props", () => {
    const prompt = buildStoryboardCompositionPrompt({
      sceneNumber: 3,
      sceneDescription: "The child points to lanterns in the fog.",
      linkedProps: [
        { title: "Lantern Bridge", description: "Rope bridge with lanterns." },
      ],
    });

    expect(prompt.systemPrompt).toContain("propsUsed");
    expect(prompt.userPrompt).toContain("Scene number: 3");
    expect(prompt.userPrompt).toContain("Lantern Bridge");
  });

  it("builds panel image prompt with storyboard sketch style", () => {
    const prompt = buildStoryboardPanelPrompt({
      sceneNumber: 2,
      background: "Soft hill silhouettes",
      foreground: "Fence and flowers",
      environment: "Small hillside town",
      characterPose: "standing and looking ahead",
      composition: "wide shot, slight high angle",
      linkedProps: [],
      outlineReferenceUrl: "https://example.com/outline.png",
    });

    expect(prompt).toContain("black-and-white only");
    expect(prompt).not.toContain("outline reference");
  });
});

describe("storyboard parsing", () => {
  it("parses snake_case composition response", () => {
    const parsed = parseAndValidateStoryboardComposition(
      JSON.stringify({
        background: "Cloudy sky",
        foreground: "Fence and flowers",
        environment: "Town square",
        character_pose: "running",
        composition: "wide shot",
        props_used: ["Lantern Bridge"],
      })
    );

    expect(parsed.characterPose).toBe("running");
    expect(parsed.propsUsed).toEqual(["Lantern Bridge"]);
  });
});
