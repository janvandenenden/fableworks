import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockInngestStep } from "@/test/mocks/inngest";

const mockAnalyzeImage = vi.fn();
const mockExtractImageUrl = vi.fn();
const mockCopyFromTempUrl = vi.fn();
const mockCreatePrediction = vi.fn();
const mockGetPrediction = vi.fn();
const mockGetReplicateClient = vi.fn();

const insertValues = vi.fn(() => ({ onConflictDoUpdate: async () => undefined }));
const updateWhere = vi.fn(async () => undefined);
const updateSet = vi.fn(() => ({ where: updateWhere }));
const update = vi.fn(() => ({ set: updateSet }));
const insert = vi.fn(() => ({ values: insertValues }));

type CharacterHandler = (input: {
  event: {
    data: {
      id: string;
      sourceImageUrl: string;
      stylePreset?: string;
      useExistingProfile?: boolean;
      promptOverride?: string;
    };
  };
  step: ReturnType<typeof createMockInngestStep>;
}) => Promise<unknown>;

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
  createPrediction: mockCreatePrediction,
  getReplicateClient: mockGetReplicateClient,
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
    mockCreatePrediction.mockResolvedValueOnce({ id: "pred-1", status: "starting" });
    mockGetPrediction.mockResolvedValueOnce({
      status: "succeeded",
      output: ["https://replicate/tmp.png"],
    });
    mockGetReplicateClient.mockReturnValueOnce({
      predictions: {
        get: mockGetPrediction,
      },
    });
    mockExtractImageUrl.mockReturnValueOnce("https://replicate/tmp.png");
    mockCopyFromTempUrl.mockResolvedValueOnce(
      "https://r2.example.com/characters/char-1/img.png"
    );

    const mod = await import("@/inngest/functions/generate-character");
    const handler: CharacterHandler = mod.generateCharacterHandler;

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

  it("reuses existing profile when requested", async () => {
    const { db } = await import("@/db");
    const selectOnce = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              approxAge: "6",
              hairColor: "black",
              hairLength: "short",
              hairTexture: "straight",
              hairStyle: "crew",
              faceShape: "oval",
              eyeColor: "brown",
              eyeShape: "round",
              skinTone: "medium",
              clothing: "hoodie",
              distinctiveFeatures: "freckles",
              colorPalette: JSON.stringify(["blue", "gray"]),
              personalityTraits: JSON.stringify(["curious"]),
              doNotChange: JSON.stringify(["freckles"]),
              rawVisionDescription: "desc",
            },
          ],
        }),
      }),
    }));
    (db.select as unknown as () => unknown) = selectOnce;

    mockCreatePrediction.mockResolvedValueOnce({ id: "pred-2", status: "starting" });
    mockGetPrediction.mockResolvedValueOnce({
      status: "succeeded",
      output: ["https://replicate/tmp2.png"],
    });
    mockGetReplicateClient.mockReturnValueOnce({
      predictions: {
        get: mockGetPrediction,
      },
    });
    mockExtractImageUrl.mockReturnValueOnce("https://replicate/tmp2.png");
    mockCopyFromTempUrl.mockResolvedValueOnce(
      "https://r2.example.com/characters/char-2/img.png"
    );

    const mod = await import("@/inngest/functions/generate-character");
    const handler: CharacterHandler = mod.generateCharacterHandler;

    const step = createMockInngestStep();

    await handler({
      event: {
        data: {
          id: "char-2",
          sourceImageUrl: "https://uploads.example.com/child.png",
          stylePreset: "watercolor",
          useExistingProfile: true,
        },
      },
      step,
    });

    expect(mockAnalyzeImage).not.toHaveBeenCalled();
  });
});
