import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockInngestStep } from "@/test/mocks/inngest";

const mockGenerateText = vi.fn();

const insertValues = vi.fn(async () => undefined);
const insert = vi.fn(() => ({ values: insertValues }));

const updateWhere = vi.fn(async () => undefined);
const updateSet = vi.fn(() => ({ where: updateWhere }));
const update = vi.fn(() => ({ set: updateSet }));

const deleteWhere = vi.fn(async () => undefined);
const del = vi.fn(() => ({ where: deleteWhere }));

vi.mock("@/db", () => ({
  db: {
    insert,
    update,
    delete: del,
  },
  schema: {
    stories: "stories",
    storyScenes: { storyId: "storyId" },
    promptArtifacts: "promptArtifacts",
  },
}));

vi.mock("@/lib/openai", () => ({
  generateText: mockGenerateText,
}));

describe("generate-story function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let counter = 0;
    vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => {
      counter += 1;
      return `story-uuid-${counter}`;
    });
  });

  it("stores concept artifact, manuscript, and scenes", async () => {
    mockGenerateText
      .mockResolvedValueOnce(
        JSON.stringify({
          emotionalCore: "A child learns courage.",
          visualHook: "A lantern path across a river.",
          toneTexture: "Warm and adventurous.",
          lessonThread: "Asking for help is brave.",
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          title: "Lantern River",
          arc_summary: "A child crosses a river with friends.",
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          scenes: Array.from({ length: 12 }, (_, index) => ({
            scene_number: index + 1,
            spread_text: `Spread text ${index + 1}`,
            scene_description: `Scene description ${index + 1}`,
          })),
        })
      );

    const mod = await import("@/inngest/functions/generate-story");
    const handler = mod.generateStoryHandler as unknown as Function;
    const step = createMockInngestStep();

    const result = await handler({
      event: {
        data: {
          id: "story-1",
          ageRange: "6-8",
          theme: "friendship",
        },
      },
      step,
    });

    expect(result).toEqual({ storyId: "story-1", sceneCount: 12 });
    expect(mockGenerateText).toHaveBeenCalledTimes(3);
    expect(del).toHaveBeenCalled();
    expect(update).toHaveBeenCalled();

    const arrayInsert = insertValues.mock.calls.find(([value]) =>
      Array.isArray(value)
    );
    expect(arrayInsert).toBeTruthy();
    expect((arrayInsert?.[0] as unknown[]).length).toBe(12);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "generating" }));
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "scenes_ready", title: "Lantern River" })
    );
  });

  it("marks story as failed when generation errors", async () => {
    mockGenerateText.mockRejectedValueOnce(new Error("OpenAI unavailable"));

    const mod = await import("@/inngest/functions/generate-story");
    const handler = mod.generateStoryHandler as unknown as Function;
    const step = createMockInngestStep();

    await expect(
      handler({
        event: {
          data: {
            id: "story-2",
            ageRange: "3-5",
            theme: null,
          },
        },
        step,
      })
    ).rejects.toThrow("OpenAI unavailable");

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "scenes_failed" }));
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", entityId: "story-2" })
    );
  });
});
