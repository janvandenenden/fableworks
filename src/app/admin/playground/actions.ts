"use server";

import { generateText, analyzeImage } from "@/lib/openai";
import { runPrediction, extractImageUrl, MODELS } from "@/lib/replicate";

type PlaygroundResult =
  | { success: true; data: { type: "text"; content: string } }
  | { success: true; data: { type: "image"; url: string } }
  | { success: false; error: string };

export async function runPlaygroundGeneration(
  mode: "openai-text" | "openai-vision" | "replicate",
  prompt: string,
  imageUrl?: string
): Promise<PlaygroundResult> {
  try {
    switch (mode) {
      case "openai-text": {
        const content = await generateText([
          { role: "user", content: prompt },
        ]);
        return { success: true, data: { type: "text", content } };
      }

      case "openai-vision": {
        if (!imageUrl) {
          return { success: false, error: "Image URL is required for vision mode" };
        }
        const content = await analyzeImage(imageUrl, prompt);
        return { success: true, data: { type: "text", content } };
      }

      case "replicate": {
        const output = await runPrediction(MODELS.nanoBanana, {
          prompt,
          num_outputs: 1,
        });
        const url = extractImageUrl(output);
        if (!url) {
          return { success: false, error: "No image URL in Replicate response" };
        }
        return { success: true, data: { type: "image", url } };
      }

      default:
        return { success: false, error: `Unknown mode: ${mode}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
