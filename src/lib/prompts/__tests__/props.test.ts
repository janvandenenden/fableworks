import { describe, expect, it } from "vitest";
import {
  buildPropsExtractionPrompts,
  parseAndValidatePropsOutput,
} from "@/lib/prompts/props";

describe("props prompts", () => {
  it("includes story and scene context", () => {
    const prompts = buildPropsExtractionPrompts({
      title: "Lantern River",
      storyArc: "A child learns courage.",
      scenes: [
        {
          sceneNumber: 1,
          spreadText: "The river glows at dusk.",
          sceneDescription: "A lantern bridge over water.",
        },
      ],
    });

    expect(prompts.userPrompt).toContain("Story title: Lantern River");
    expect(prompts.userPrompt).toContain("Scene 1:");
    expect(prompts.systemPrompt).toContain("title, category, description, tags");
  });
});

describe("props parsing", () => {
  it("parses valid props JSON", () => {
    const parsed = parseAndValidatePropsOutput(
      JSON.stringify({
        props: [
          {
            title: "Lantern Bridge",
            category: "object",
            description: "A rope bridge lined with amber lanterns.",
            tags: ["bridge", "light"],
            appearsInScenes: [1, 2, 8],
          },
        ],
      })
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.title).toBe("Lantern Bridge");
    expect(parsed[0]?.appearsInScenes).toEqual([1, 2, 8]);
  });
});
