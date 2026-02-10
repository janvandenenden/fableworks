import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockInngestStep } from "@/test/mocks/inngest";

const mockAnalyzeImage = vi.fn();
const mockRunPrediction = vi.fn();
const mockExtractImageUrl = vi.fn();
const mockCopyFromTempUrl = vi.fn();

const insertValues = vi.fn(async () => undefined);
const updateWhere = vi.fn(async () => undefined);
const updateSet = vi.fn(() => ({ where: updateWhere }));
const update = vi.fn(() => ({ set: updateSet }));
const insert = vi.fn(() => ({ values: insertValues }));

vi.mock("@/db", () => ({
  db: {
    insert,
    update,
  },
  schema: {
    characters: "characters",
    characterProfiles: "characterProfiles",
    promptArtifacts: "promptArtifacts",
    characterImages: "characterImages",
  },
}));

vi.mock("@/lib/openai", () => ({
  analyzeImage: mockAnalyzeImage,
}));

vi.mock("@/lib/replicate", () => ({
  MODELS: {
    nanoBanana: "model",
  },
  runPrediction: mockRunPrediction,
  extractImageUrl: mockExtractImageUrl,
}));

vi.mock("@/lib/r2", () => ({
  copyFromTempUrl: mockCopyFromTempUrl,
}));

describe("generate-character function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let counter = 0;
    vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => {
      counter += 1;
      return `uuid-${counter}`;
    });
  });

  it("stores profile, prompt, and image records", async () => {
    mockAnalyzeImage.mockResolvedValueOnce(
      JSON.stringify({
        approxAge: "young_child",
        hairColor: "brown",
        eyeColor: "green",
        colorPalette: ["warm", "pastel"],
        doNotChange: ["freckles"],
      })
    );
    mockRunPrediction.mockResolvedValueOnce("https://replicate/tmp.png");
    mockExtractImageUrl.mockReturnValueOnce("https://replicate/tmp.png");
    mockCopyFromTempUrl.mockResolvedValueOnce(
      "https://r2.example.com/characters/char-1/img.png"
    );

    const mod = await import("@/inngest/functions/generate-character");
    const handler =
      (mod.generateCharacter as { handler?: Function }).handler ??
      (mod.generateCharacter as unknown as Function);

    const step = createMockInngestStep();

    await handler({
      event: {
        data: {
          id: "char-1",
          sourceImageUrl: "https://uploads.example.com/child.png",
          stylePreset: "watercolor",
        },
      },
      step,
    });

    expect(insert).toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
    expect(updateWhere).toHaveBeenCalled();
  });
});
