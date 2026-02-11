import { describe, expect, it } from "vitest";
import {
  buildStoryConceptPrompts,
  buildStoryManuscriptPrompts,
  buildStoryScenesPrompts,
  cleanJsonResponse,
  getStorySpreadTarget,
  parseAndValidateStoryConcept,
  parseAndValidateStoryManuscript,
  parseAndValidateStoryOutput,
} from "@/lib/prompts/story";

describe("story prompts", () => {
  it("builds concept prompts with age range and optional theme", () => {
    const prompts = buildStoryConceptPrompts({
      ageRange: "6-8",
      theme: "friendship",
    });

    expect(prompts.userPrompt).toContain("Target age range: 6-8");
    expect(prompts.userPrompt).toContain("Theme or lesson seed: friendship");
    expect(prompts.systemPrompt).toContain("{{name}}");
    expect(prompts.systemPrompt).toContain("neutral phrasing");
  });

  it("includes dynamic spread target and minimum spread constraint", () => {
    const prompts = buildStoryScenesPrompts({
      ageRange: "9-12",
      theme: null,
      conceptJson: '{"emotionalCore":"courage"}',
      manuscriptJson: '{"title":"T","arcSummary":"A"}',
    });

    expect(prompts.systemPrompt).toContain("at least 12 scenes");
    expect(prompts.systemPrompt).toContain("target 16 scenes");
  });

  it("builds manuscript prompt", () => {
    const prompts = buildStoryManuscriptPrompts({
      ageRange: "6-8",
      theme: "friendship",
      conceptJson: '{"emotionalCore":"courage"}',
    });
    expect(prompts.systemPrompt).toContain("title, arc_summary");
    expect(prompts.userPrompt).toContain("Theme or lesson: friendship");
  });
});

describe("story spread targets", () => {
  it("returns expected targets by age range", () => {
    expect(getStorySpreadTarget("3-5")).toBe(12);
    expect(getStorySpreadTarget("6-8")).toBe(14);
    expect(getStorySpreadTarget("9-12")).toBe(16);
  });
});

describe("story parsing", () => {
  it("parses concept response", () => {
    const parsed = parseAndValidateStoryConcept(
      JSON.stringify({
        emotionalCore: "Belonging grows through small brave choices.",
        visualHook: "A lantern trail through misty reeds.",
        toneTexture: "Warm, adventurous, reflective.",
        lessonThread: "Ask for help and give help.",
      })
    );

    expect(parsed.emotionalCore).toContain("Belonging");
    expect(parsed.visualHook).toContain("lantern");
  });

  it("strips markdown fences from model JSON output", () => {
    const cleaned = cleanJsonResponse("```json\n{\"title\":\"A\"}\n```");
    expect(cleaned).toBe('{"title":"A"}');
  });

  it("parses manuscript response", () => {
    const parsed = parseAndValidateStoryManuscript(
      JSON.stringify({
        title: "A River Story",
        arc_summary: "A child learns patience.",
      })
    );
    expect(parsed.title).toBe("A River Story");
    expect(parsed.arcSummary).toBe("A child learns patience.");
  });

  it("parses snake_case response and validates scene minimum", () => {
    const scenes = Array.from({ length: 12 }, (_, index) => ({
      scene_number: index + 1,
      spread_text: `Scene text ${index + 1}`,
      scene_description: `Description ${index + 1}`,
    }));

    const parsed = parseAndValidateStoryOutput(
      JSON.stringify({
        scenes,
      })
    );

    expect(parsed).toHaveLength(12);
    expect(parsed[0]?.sceneNumber).toBe(1);
  });

  it("fails validation when scene count is below 12", () => {
    const scenes = Array.from({ length: 11 }, (_, index) => ({
      scene_number: index + 1,
      spread_text: `Scene text ${index + 1}`,
      scene_description: `Description ${index + 1}`,
    }));

    expect(() =>
      parseAndValidateStoryOutput(
        JSON.stringify({
          scenes,
        })
      )
    ).toThrow();
  });
});
