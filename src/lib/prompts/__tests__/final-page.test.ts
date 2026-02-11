import { describe, expect, it } from "vitest";
import {
  buildFinalPagePrompt,
  buildFinalPageRequestPayload,
  FINAL_PAGE_ASPECT_RATIO,
} from "@/lib/prompts/final-page";

describe("final page prompts", () => {
  it("builds prompt with storyboard, character, and props context", () => {
    const prompt = buildFinalPagePrompt({
      sceneNumber: 4,
      spreadText: "{{name}} follows the lantern trail.",
      sceneDescription: "The child walks into a glowing garden.",
      storyboardComposition: "wide shot, eye-level",
      storyboardBackground: "Twilight sky and distant hills",
      storyboardForeground: "Lanterns and flowers",
      storyboardEnvironment: "Garden path",
      storyboardCharacterPose: "walking carefully",
      stylePreset: "storybook watercolor",
      colorPalette: ["warm amber", "teal", "cream"],
      characterProfileSummary: "young child with short curly hair and green coat",
      doNotChange: ["same face shape", "same hair texture", "same coat silhouette"],
      linkedProps: [{ title: "Lantern Trail", description: "small hanging lanterns" }],
      characterReferenceUrl: "https://example.com/character.png",
      storyboardReferenceUrl: "https://example.com/storyboard.png",
    });

    expect(prompt).toContain("Final illustrated page");
    expect(prompt).toContain("scene number: 4");
    expect(prompt).toContain("Lantern Trail");
    expect(prompt).toContain("same face shape");
    expect(prompt).toContain("character reference image URL");
    expect(prompt).toContain("storyboard reference image URL");
    expect(prompt).toContain("no text overlays");
    expect(prompt).toContain("the child follows the lantern trail.");
    expect(prompt).not.toContain("{{name}}");
  });

  it("builds request payload with final page defaults", () => {
    const payload = buildFinalPageRequestPayload({
      prompt: "Final page prompt",
      storyboardReferenceUrl: "https://example.com/storyboard.png",
    });

    expect(payload).toEqual({
      prompt: "Final page prompt",
      aspect_ratio: FINAL_PAGE_ASPECT_RATIO,
      output_format: "png",
      image: "https://example.com/storyboard.png",
    });
  });
});
