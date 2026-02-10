import { vi } from "vitest";

export const mockChatResponse = {
  choices: [
    {
      message: {
        content: "This is a mock OpenAI response.",
      },
    },
  ],
};

export const mockVisionResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          approx_age: "young_child",
          hair_color: "brown",
          hair_length: "medium",
          hair_texture: "straight",
          hair_style: "loose",
          face_shape: "round",
          eye_color: "brown",
          eye_shape: "almond",
          skin_tone: "light",
          clothing: "blue t-shirt",
          distinctive_features: "freckles",
        }),
      },
    },
  ],
};

export function createMockOpenAIClient() {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue(mockChatResponse),
      },
    },
  };
}

export function mockOpenAIModule() {
  const mockClient = createMockOpenAIClient();
  vi.mock("@/lib/openai", () => ({
    getOpenAIClient: vi.fn(() => mockClient),
    generateText: vi.fn(async () => mockChatResponse.choices[0].message.content),
    analyzeImage: vi.fn(
      async () => mockVisionResponse.choices[0].message.content
    ),
  }));
  return mockClient;
}
