import { vi } from "vitest";

export const mockReplicateOutput = [
  "https://replicate-temp.example.com/output/generated-image.png",
];

export function createMockReplicateClient() {
  return {
    run: vi.fn().mockResolvedValue(mockReplicateOutput),
    predictions: {
      create: vi.fn().mockResolvedValue({
        id: "mock-prediction-id",
        status: "starting",
      }),
      get: vi.fn().mockResolvedValue({
        id: "mock-prediction-id",
        status: "succeeded",
        output: mockReplicateOutput,
      }),
    },
  };
}

export function mockReplicateModule() {
  const mockClient = createMockReplicateClient();
  vi.mock("@/lib/replicate", () => ({
    getReplicateClient: vi.fn(() => mockClient),
    runPrediction: vi.fn(async () => mockReplicateOutput),
    createPrediction: vi.fn(async () => ({
      id: "mock-prediction-id",
      status: "starting",
    })),
    extractImageUrl: vi.fn((output: unknown) => {
      if (Array.isArray(output) && typeof output[0] === "string")
        return output[0];
      if (typeof output === "string") return output;
      return null;
    }),
    MODELS: {
      nanoBanana:
        "google/nano-banana:d05a591283da31be3eea28d5634ef9e26989b351718b6489bd308426ebd0a3e8",
      nanoBananaPro:
        "google/nano-banana-pro:0785fb14f5aaa30eddf06fd49b6cbdaac4541b8854eb314211666e23a29087e3",
    },
  }));
  return mockClient;
}
