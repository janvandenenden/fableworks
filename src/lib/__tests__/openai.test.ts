import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn().mockResolvedValue({
  choices: [{ message: { content: "Test response" } }],
});

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
      constructor(_opts: unknown) {}
    },
  };
});

// Reset singleton between tests by clearing module cache
let getOpenAIClient: typeof import("@/lib/openai").getOpenAIClient;
let generateText: typeof import("@/lib/openai").generateText;
let analyzeImage: typeof import("@/lib/openai").analyzeImage;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  const mod = await import("@/lib/openai");
  getOpenAIClient = mod.getOpenAIClient;
  generateText = mod.generateText;
  analyzeImage = mod.analyzeImage;
});

describe("openai", () => {
  describe("getOpenAIClient", () => {
    it("creates a client successfully", () => {
      const client = getOpenAIClient();
      expect(client).toBeDefined();
      expect(client.chat.completions.create).toBeDefined();
    });

    it("returns the same instance on subsequent calls", () => {
      const client1 = getOpenAIClient();
      const client2 = getOpenAIClient();
      expect(client1).toBe(client2);
    });
  });

  describe("generateText", () => {
    it("returns the response content", async () => {
      const result = await generateText([
        { role: "user", content: "Hello" },
      ]);
      expect(result).toBe("Test response");
    });

    it("passes model and temperature options", async () => {
      await generateText(
        [{ role: "user", content: "Hello" }],
        { model: "gpt-4o-mini", temperature: 0.5 }
      );
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4o-mini",
          temperature: 0.5,
        })
      );
    });

    it("supports json_object response format", async () => {
      await generateText(
        [{ role: "user", content: "Return JSON" }],
        { responseFormat: "json_object" }
      );
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: { type: "json_object" },
        })
      );
    });

    it("throws when response has no content", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });
      await expect(
        generateText([{ role: "user", content: "Hello" }])
      ).rejects.toThrow("No content in OpenAI response");
    });
  });

  describe("analyzeImage", () => {
    it("calls with image_url content type", async () => {
      await analyzeImage("https://example.com/image.jpg", "Describe this");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Describe this" },
                {
                  type: "image_url",
                  image_url: { url: "https://example.com/image.jpg" },
                },
              ],
            },
          ],
        })
      );
    });

    it("returns the response content", async () => {
      const result = await analyzeImage(
        "https://example.com/image.jpg",
        "Describe this"
      );
      expect(result).toBe("Test response");
    });
  });
});
