import { describe, it, expect } from "vitest";
import {
  buildCharacterPrompt,
  characterStyleTokens,
  getStylePresets,
} from "@/lib/prompts/character";

describe("buildCharacterPrompt", () => {
  it("includes style tokens and core description", () => {
    const prompt = buildCharacterPrompt(
      {
        approxAge: "young_child",
        hairColor: "brown",
        eyeColor: "green",
      },
      "watercolor"
    );

    expect(prompt).toContain("Children's storybook character");
    expect(prompt).toContain("age: young_child");
    expect(prompt).toContain("hair color: brown");
    expect(prompt).toContain(characterStyleTokens.watercolor);
  });

  it("adds do_not_change invariants when provided", () => {
    const prompt = buildCharacterPrompt(
      {
        doNotChange: ["freckles", "round glasses"],
      },
      "flat"
    );

    expect(prompt).toContain("do not change: freckles, round glasses");
  });
});

describe("getStylePresets", () => {
  it("returns all style presets", () => {
    const presets = getStylePresets();
    const values = presets.map((preset) => preset.value);
    expect(values).toEqual([
      "watercolor",
      "storybook",
      "anime",
      "flat",
      "colored-pencil",
    ]);
  });
});
