import { z } from "zod";

function cleanJsonResponse(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export function buildPropsExtractionPrompts(input: {
  title?: string | null;
  storyArc?: string | null;
  scenes: Array<{ sceneNumber: number; spreadText?: string | null; sceneDescription?: string | null }>;
}) {
  const sceneContext = input.scenes
    .map(
      (scene) =>
        `Scene ${scene.sceneNumber}: text=${scene.spreadText ?? ""}; description=${scene.sceneDescription ?? ""}`
    )
    .join("\n");

  return {
    systemPrompt: [
      "You are extracting a production props bible from a children's picture-book manuscript.",
      "Return valid JSON only.",
      "Do not include the protagonist as a prop.",
      "Output must include an array field: props.",
      "Each prop item must include: title, category, description, tags, appearsInScenes.",
      "Allowed category values: object, environment, element.",
      "description must be precise enough that two illustrators would draw the same result.",
      "Use explicit visual specifications: exact color names, shape, material, texture, scale, position, and lighting direction/intensity.",
      "Do not use HEX color codes.",
      "Write descriptions like you are explaining visuals to a blind person: concrete, observable, and unambiguous details.",
      "Avoid vague language like 'cheerful', 'nice', or 'reflecting happiness' without concrete visual detail.",
      "appearsInScenes must list scene numbers where the prop is visible or explicitly mentioned.",
    ].join(" "),
    userPrompt: [
      `Story title: ${input.title ?? "Untitled"}.`,
      `Story arc: ${input.storyArc ?? "N/A"}.`,
      "Scene context:",
      sceneContext,
    ].join("\n"),
  };
}

const propCategorySchema = z.enum(["object", "environment", "element"]);

const rawPropSchema = z
  .object({
    title: z.string().min(1),
    category: z.string().optional(),
    description: z.string().min(1),
    tags: z.array(z.string()).optional(),
    appearsInScenes: z.array(z.number().int().positive()).optional(),
    appears_in_scenes: z.array(z.number().int().positive()).optional(),
  })
  .transform((value) => ({
    title: value.title.trim(),
    category: propCategorySchema.parse(value.category ?? "object"),
    description: value.description.trim(),
    tags: value.tags ?? [],
    appearsInScenes: Array.from(
      new Set(value.appearsInScenes ?? value.appears_in_scenes ?? [])
    ).sort((a, b) => a - b),
  }));

const rawPropsOutputSchema = z.object({
  props: z.array(rawPropSchema),
});

export const propsOutputSchema = z.array(
  z.object({
    title: z.string().min(1),
    category: propCategorySchema,
    description: z.string().min(1),
    tags: z.array(z.string()),
    appearsInScenes: z.array(z.number().int().positive()),
  })
);

export type PropsOutput = z.infer<typeof propsOutputSchema>;

export function parseAndValidatePropsOutput(raw: string): PropsOutput {
  const parsed = JSON.parse(cleanJsonResponse(raw)) as unknown;
  return propsOutputSchema.parse(rawPropsOutputSchema.parse(parsed).props);
}
