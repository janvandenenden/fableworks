import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRun = vi.fn().mockResolvedValue(["https://example.com/output.png"]);
const mockPredictionsCreate = vi.fn().mockResolvedValue({
  id: "pred-123",
  status: "starting",
});

vi.mock("replicate", () => {
  return {
    default: class MockReplicate {
      run = mockRun;
      predictions = {
        create: mockPredictionsCreate,
      };
      constructor(opts: unknown) {
        void opts;
      }
    },
  };
});

let getReplicateClient: typeof import("@/lib/replicate").getReplicateClient;
let runPrediction: typeof import("@/lib/replicate").runPrediction;
let createPrediction: typeof import("@/lib/replicate").createPrediction;
let extractImageUrl: typeof import("@/lib/replicate").extractImageUrl;
let MODELS: typeof import("@/lib/replicate").MODELS;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  const mod = await import("@/lib/replicate");
  getReplicateClient = mod.getReplicateClient;
  runPrediction = mod.runPrediction;
  createPrediction = mod.createPrediction;
  extractImageUrl = mod.extractImageUrl;
  MODELS = mod.MODELS;
});

describe("replicate", () => {
  describe("MODELS", () => {
    it("has correct NanoBanana model ID", () => {
      expect(MODELS.nanoBanana).toBe(
        "google/nano-banana:d05a591283da31be3eea28d5634ef9e26989b351718b6489bd308426ebd0a3e8"
      );
    });

    it("has correct NanoBanana Pro model ID", () => {
      expect(MODELS.nanoBananaPro).toBe(
        "google/nano-banana-pro:0785fb14f5aaa30eddf06fd49b6cbdaac4541b8854eb314211666e23a29087e3"
      );
    });
  });

  describe("getReplicateClient", () => {
    it("creates a client successfully", () => {
      const client = getReplicateClient();
      expect(client).toBeDefined();
      expect(client.run).toBeDefined();
    });

    it("returns the same instance on subsequent calls", () => {
      const client1 = getReplicateClient();
      const client2 = getReplicateClient();
      expect(client1).toBe(client2);
    });
  });

  describe("runPrediction", () => {
    it("calls client.run and returns the output", async () => {
      const result = await runPrediction(MODELS.nanoBanana, {
        prompt: "a cute cat",
      });
      expect(result).toEqual(["https://example.com/output.png"]);
      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe("createPrediction", () => {
    it("creates a prediction and returns id + status", async () => {
      const result = await createPrediction(MODELS.nanoBanana, {
        prompt: "a cute cat",
      });
      expect(result).toEqual({ id: "pred-123", status: "starting" });
      expect(mockPredictionsCreate).toHaveBeenCalled();
    });
  });

  describe("extractImageUrl", () => {
    it("extracts URL from string output", () => {
      expect(extractImageUrl("https://example.com/img.png")).toBe(
        "https://example.com/img.png"
      );
    });

    it("extracts first URL from array output", () => {
      expect(
        extractImageUrl(["https://example.com/img.png", "https://example.com/img2.png"])
      ).toBe("https://example.com/img.png");
    });

    it("extracts URL from object with url field", () => {
      expect(
        extractImageUrl({ url: "https://example.com/img.png" })
      ).toBe("https://example.com/img.png");
    });

    it("returns null for unrecognized output", () => {
      expect(extractImageUrl(42)).toBeNull();
      expect(extractImageUrl(null)).toBeNull();
      expect(extractImageUrl({})).toBeNull();
    });
  });
});
