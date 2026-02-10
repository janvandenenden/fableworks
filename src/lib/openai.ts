import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function generateText(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: "text" | "json_object";
  }
): Promise<string> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: options?.model ?? "gpt-4o",
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 4096,
    ...(options?.responseFormat === "json_object" && {
      response_format: { type: "json_object" },
    }),
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content in OpenAI response");
  }
  return content;
}

export async function analyzeImage(
  imageUrl: string,
  prompt: string,
  options?: {
    model?: string;
    maxTokens?: number;
  }
): Promise<string> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: options?.model ?? "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    max_tokens: options?.maxTokens ?? 4096,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No content in OpenAI Vision response");
  }
  return content;
}
