import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { inngest } from "@/inngest/client";
import { generateText } from "@/lib/openai";
import {
  buildStoryConceptPrompts,
  buildStoryManuscriptPrompts,
  buildStoryScenesPrompts,
  parseAndValidateStoryConcept,
  parseAndValidateStoryManuscript,
  parseAndValidateStoryOutput,
  storyAgeRanges,
} from "@/lib/prompts/story";

const storyCreatedSchema = z.object({
  id: z.string(),
  ageRange: z.enum(storyAgeRanges),
  theme: z.string().optional().nullable(),
});

type StoryCreatedPayload = z.infer<typeof storyCreatedSchema>;

function newId(): string {
  return crypto.randomUUID();
}

function getTheme(theme?: string | null): string | null {
  if (!theme) return null;
  const trimmed = theme.trim();
  return trimmed.length ? trimmed : null;
}

export async function generateStoryHandler({
  event,
  step,
}: {
  event: { data: StoryCreatedPayload };
  step: {
    run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  };
}) {
  const payload = storyCreatedSchema.parse(event.data);
  const theme = getTheme(payload.theme);

  try {
    await step.run("mark-generating", () =>
      db
        .update(schema.stories)
        .set({ status: "generating" })
        .where(eq(schema.stories.id, payload.id))
    );

    const conceptPrompts = buildStoryConceptPrompts({
      ageRange: payload.ageRange,
      theme,
    });

    const conceptRaw = await step.run("generate-concept", () =>
      generateText(
        [
          { role: "system", content: conceptPrompts.systemPrompt },
          { role: "user", content: conceptPrompts.userPrompt },
        ],
        {
          model: "gpt-4o",
          maxTokens: 1400,
          temperature: 0.7,
        }
      )
    );
    const concept = parseAndValidateStoryConcept(conceptRaw);

    await step.run("record-concept-artifact", () =>
      db.insert(schema.promptArtifacts).values({
        id: newId(),
        entityType: "story",
        entityId: payload.id,
        rawPrompt: `${conceptPrompts.systemPrompt}\n\n${conceptPrompts.userPrompt}`,
        model: "gpt-4o",
        status: "success",
        structuredFields: JSON.stringify({
          phase: "concept",
          concept,
        }),
      })
    );

    const manuscriptPrompts = buildStoryManuscriptPrompts({
      ageRange: payload.ageRange,
      theme,
      conceptJson: JSON.stringify(concept),
    });

    const manuscriptRaw = await step.run("generate-manuscript", () =>
      generateText(
        [
          { role: "system", content: manuscriptPrompts.systemPrompt },
          { role: "user", content: manuscriptPrompts.userPrompt },
        ],
        {
          model: "gpt-4o",
          maxTokens: 1200,
          temperature: 0.7,
        }
      )
    );
    const manuscript = parseAndValidateStoryManuscript(manuscriptRaw);

    const scenesPrompts = buildStoryScenesPrompts({
      ageRange: payload.ageRange,
      theme,
      conceptJson: JSON.stringify(concept),
      manuscriptJson: JSON.stringify(manuscript),
    });

    const scenesRaw = await step.run("generate-scenes", () =>
      generateText(
        [
          { role: "system", content: scenesPrompts.systemPrompt },
          { role: "user", content: scenesPrompts.userPrompt },
        ],
        {
          model: "gpt-4o",
          maxTokens: 4096,
          temperature: 0.7,
        }
      )
    );
    const scenes = parseAndValidateStoryOutput(scenesRaw);

    await step.run("record-story-artifact", () =>
      db.insert(schema.promptArtifacts).values({
        id: newId(),
        entityType: "story",
        entityId: payload.id,
        rawPrompt: `${scenesPrompts.systemPrompt}\n\n${scenesPrompts.userPrompt}`,
        model: "gpt-4o",
        status: "success",
        structuredFields: JSON.stringify({
          phase: "manuscript",
          title: manuscript.title,
          sceneCount: scenes.length,
        }),
      })
    );

    await step.run("replace-scenes", async () => {
      await db
        .delete(schema.storyScenes)
        .where(eq(schema.storyScenes.storyId, payload.id));

      await db.insert(schema.storyScenes).values(
        scenes.map((scene) => ({
          id: newId(),
          storyId: payload.id,
          sceneNumber: scene.sceneNumber,
          spreadText: scene.spreadText,
          sceneDescription: scene.sceneDescription,
        }))
      );
    });

    await step.run("mark-ready", () =>
      db
        .update(schema.stories)
        .set({
          title: manuscript.title,
          storyArc: manuscript.arcSummary,
          status: "scenes_ready",
        })
        .where(eq(schema.stories.id, payload.id))
    );

    return { storyId: payload.id, sceneCount: scenes.length };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate story";

    await step.run("mark-failed", () =>
      db
        .update(schema.stories)
        .set({ status: "scenes_failed" })
        .where(eq(schema.stories.id, payload.id))
    );

    await step.run("record-error-artifact", () =>
      db.insert(schema.promptArtifacts).values({
        id: newId(),
        entityType: "story",
        entityId: payload.id,
        rawPrompt: "story generation failure",
        model: "gpt-4o",
        status: "failed",
        errorMessage: message,
      })
    );

    throw error;
  }
}

export const generateStory = inngest.createFunction(
  { id: "generate-story" },
  { event: "story/created" },
  generateStoryHandler
);
