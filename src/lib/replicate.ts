import Replicate from "replicate";

export const MODELS = {
  nanoBanana:
    "google/nano-banana:d05a591283da31be3eea28d5634ef9e26989b351718b6489bd308426ebd0a3e8" as const,
  nanoBananaPro:
    "google/nano-banana-pro:0785fb14f5aaa30eddf06fd49b6cbdaac4541b8854eb314211666e23a29087e3" as const,
} as const;

let replicateClient: Replicate | null = null;

export function getReplicateClient(): Replicate {
  if (!replicateClient) {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      throw new Error("REPLICATE_API_TOKEN environment variable is not set");
    }
    replicateClient = new Replicate({ auth: token });
  }
  return replicateClient;
}

export type PredictionInput = Record<string, unknown>;

export async function runPrediction(
  model: string,
  input: PredictionInput
): Promise<unknown> {
  const client = getReplicateClient();
  const output = await client.run(model as `${string}/${string}:${string}`, {
    input,
  });
  return output;
}

export async function createPrediction(
  model: string,
  input: PredictionInput,
  webhookUrl?: string
): Promise<{ id: string; status: string }> {
  const client = getReplicateClient();
  const [owner, rest] = model.split("/");
  const [name, version] = rest.split(":");

  const prediction = await client.predictions.create({
    version,
    input,
    ...(webhookUrl && {
      webhook: webhookUrl,
      webhook_events_filter: ["completed"],
    }),
  });

  return { id: prediction.id, status: prediction.status };
}

export function extractImageUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const first = output[0] as unknown;
    if (typeof first === "string") return first;
    if (
      first &&
      typeof first === "object" &&
      "url" in first &&
      typeof (first as { url: unknown }).url === "string"
    ) {
      return (first as { url: string }).url;
    }
    if (
      first &&
      typeof first === "object" &&
      "image" in first &&
      typeof (first as { image: unknown }).image === "string"
    ) {
      return (first as { image: string }).image;
    }
  }
  if (
    output &&
    typeof output === "object" &&
    "image" in output &&
    typeof (output as { image: unknown }).image === "string"
  ) {
    return (output as { image: string }).image;
  }
  if (
    output &&
    typeof output === "object" &&
    "output" in output &&
    Array.isArray((output as { output: unknown }).output)
  ) {
    const value = (output as { output: unknown }).output;
    if (Array.isArray(value)) {
      const first = value[0] as unknown;
      if (typeof first === "string") return first;
      if (
        first &&
        typeof first === "object" &&
        "url" in first &&
        typeof (first as { url: unknown }).url === "string"
      ) {
        return (first as { url: string }).url;
      }
      if (
        first &&
        typeof first === "object" &&
        "image" in first &&
        typeof (first as { image: unknown }).image === "string"
      ) {
        return (first as { image: string }).image;
      }
    }
  }
  if (
    output &&
    typeof output === "object" &&
    "output" in output &&
    typeof (output as { output: unknown }).output === "string"
  ) {
    return (output as { output: string }).output;
  }
  if (
    output &&
    typeof output === "object" &&
    "images" in output &&
    Array.isArray((output as { images: unknown }).images)
  ) {
    const value = (output as { images: unknown }).images;
    if (Array.isArray(value)) {
      const first = value[0] as unknown;
      if (typeof first === "string") return first;
      if (
        first &&
        typeof first === "object" &&
        "url" in first &&
        typeof (first as { url: unknown }).url === "string"
      ) {
        return (first as { url: string }).url;
      }
    }
  }
  if (
    output &&
    typeof output === "object" &&
    "url" in output &&
    typeof (output as { url: unknown }).url === "string"
  ) {
    return (output as { url: string }).url;
  }
  return null;
}
