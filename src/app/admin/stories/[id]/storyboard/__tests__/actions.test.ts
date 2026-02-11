import { beforeEach, describe, expect, it, vi } from "vitest";

type RowMap = Record<string, unknown[]>;

const tableRows: RowMap = {};
const insertValues = vi.fn(async () => undefined);
const updateWhere = vi.fn(async () => undefined);
const updateSet = vi.fn(() => ({ where: updateWhere }));
const update = vi.fn(() => ({ set: updateSet }));

function setRows(table: string, rows: unknown[]) {
  tableRows[table] = rows;
}

function clearRows() {
  for (const key of Object.keys(tableRows)) {
    delete tableRows[key];
  }
}

function makeAwaitableWhereResult(rows: unknown[]) {
  return {
    limit: async (count: number) => rows.slice(0, count),
    orderBy: () => rows,
    then: (resolve: (value: unknown[]) => unknown) =>
      Promise.resolve(rows).then(resolve),
  };
}

const select = vi.fn(() => ({
  from: (table: { __table?: string }) => ({
    where: () => makeAwaitableWhereResult(tableRows[table.__table ?? ""] ?? []),
  }),
}));

vi.mock("@/db", () => ({
  db: {
    select,
    insert: vi.fn(() => ({ values: insertValues })),
    update,
    delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
  },
  schema: {
    stories: { __table: "stories", id: "id", status: "status" },
    storyScenes: { __table: "story_scenes", id: "id", storyId: "storyId" },
    propsBibleEntries: {
      __table: "props_bible_entries",
      title: "title",
      description: "description",
      appearsInScenes: "appearsInScenes",
      storyId: "storyId",
    },
    storyboardPanels: {
      __table: "storyboard_panels",
      id: "id",
      sceneId: "sceneId",
    },
    promptArtifacts: {
      __table: "prompt_artifacts",
      id: "id",
      entityId: "entityId",
      entityType: "entityType",
      parameters: "parameters",
    },
    generatedAssets: { __table: "generated_assets", id: "id" },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
  asc: vi.fn(() => ({})),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const outlineUrl = vi.fn(() => "https://example.com/outline.png");

vi.mock("@/lib/prompts/storyboard", () => ({
  STORYBOARD_ASPECT_RATIO: "4:3",
  buildStoryboardCompositionPrompt: vi.fn(() => ({
    systemPrompt: "system",
    userPrompt: "user",
  })),
  parseAndValidateStoryboardComposition: vi.fn(() => ({
    background: "bg",
    foreground: "fg",
    environment: "env",
    characterPose: "pose",
    composition: "comp",
    propsUsed: [],
  })),
  buildStoryboardPanelPrompt: vi.fn(() => "prompt"),
  getStoryboardOutlineReferenceUrl: outlineUrl,
}));

vi.mock("@/lib/openai", () => ({
  generateText: vi.fn(async () => "{}"),
}));

vi.mock("@/lib/replicate", () => ({
  MODELS: { nanoBananaPro: "model-pro" },
  createPrediction: vi.fn(async () => ({ id: "pred-1", status: "succeeded" })),
  getReplicateClient: vi.fn(() => ({
    predictions: {
      get: vi.fn(async () => ({
        status: "succeeded",
        output: "https://replicate.example/panel.png",
      })),
    },
  })),
  extractImageUrl: vi.fn(() => "https://replicate.example/panel.png"),
}));

vi.mock("@/lib/r2", () => ({
  copyFromTempUrl: vi.fn(async () => "https://r2.example/panel.png"),
}));

describe("storyboard actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRows();
    setRows("storyboard_panels", [{ id: "panel-1", sceneId: "scene-1" }]);
    setRows("story_scenes", [{ id: "scene-1", sceneNumber: 1 }]);
    setRows("props_bible_entries", []);
    setRows("prompt_artifacts", []);
  });

  it("updateStoryboardCompositionAction serializes props and marks composed", async () => {
    const { updateStoryboardCompositionAction } = await import(
      "@/app/admin/stories/[id]/storyboard/actions"
    );

    const formData = new FormData();
    formData.set("background", "Hill");
    formData.set("foreground", "Flowers");
    formData.set("environment", "Town");
    formData.set("characterPose", "running");
    formData.set("composition", "wide");
    formData.set("propsUsed", "Lantern, Kite");

    const result = await updateStoryboardCompositionAction(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      formData
    );

    expect(result.success).toBe(true);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "composed",
        propsUsed: JSON.stringify(["Lantern", "Kite"]),
      })
    );
  });

  it("saveStoryboardPanelPromptDraftAction saves prompt draft artifact", async () => {
    const { saveStoryboardPanelPromptDraftAction } = await import(
      "@/app/admin/stories/[id]/storyboard/actions"
    );

    const formData = new FormData();
    formData.set("storyId", "00000000-0000-4000-8000-000000000001");
    formData.set("panelId", "00000000-0000-4000-8000-000000000002");
    formData.set("promptOverride", "Storyboard prompt draft");

    const result = await saveStoryboardPanelPromptDraftAction(formData);

    expect(result.success).toBe(true);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "storyboard_panel_prompt_draft",
        rawPrompt: "Storyboard prompt draft",
      })
    );
  });

  it("generateStoryboardPanelImageFromRunAction rejects invalid run artifact type", async () => {
    setRows("prompt_artifacts", [
      {
        id: "00000000-0000-4000-8000-000000000010",
        entityType: "storyboard_panel_prompt_draft",
        entityId: "00000000-0000-4000-8000-000000000002",
        parameters: {
          prompt: "x",
          aspect_ratio: "4:3",
          output_format: "png",
          image: "https://example.com/outline.png",
        },
      },
    ]);

    const { generateStoryboardPanelImageFromRunAction } = await import(
      "@/app/admin/stories/[id]/storyboard/actions"
    );

    const formData = new FormData();
    formData.set("storyId", "00000000-0000-4000-8000-000000000001");
    formData.set("panelId", "00000000-0000-4000-8000-000000000002");
    formData.set("runArtifactId", "00000000-0000-4000-8000-000000000010");

    const result = await generateStoryboardPanelImageFromRunAction(formData);

    expect(result).toEqual({
      success: false,
      error: "Invalid run artifact type",
    });
  });

  it("generateStoryboardPanelImageFromRunAction reuses stored payload on success", async () => {
    setRows("prompt_artifacts", [
      {
        id: "00000000-0000-4000-8000-000000000011",
        entityType: "storyboard_panel_image",
        entityId: "00000000-0000-4000-8000-000000000002",
        parameters: {
          prompt: "stored run prompt",
          aspect_ratio: "4:3",
          output_format: "png",
          image: "https://example.com/outline.png",
        },
      },
    ]);
    setRows("storyboard_panels", [
      {
        id: "00000000-0000-4000-8000-000000000002",
        sceneId: "scene-1",
        background: "bg",
        foreground: "fg",
        environment: "env",
        characterPose: "pose",
        composition: "wide",
      },
    ]);

    const { createPrediction } = await import("@/lib/replicate");
    const createPredictionMock = createPrediction as unknown as ReturnType<
      typeof vi.fn
    >;

    const { generateStoryboardPanelImageFromRunAction } = await import(
      "@/app/admin/stories/[id]/storyboard/actions"
    );

    const formData = new FormData();
    formData.set("storyId", "00000000-0000-4000-8000-000000000001");
    formData.set("panelId", "00000000-0000-4000-8000-000000000002");
    formData.set("runArtifactId", "00000000-0000-4000-8000-000000000011");

    const result = await generateStoryboardPanelImageFromRunAction(formData);

    expect(result.success).toBe(true);
    expect(createPredictionMock).toHaveBeenCalledWith("model-pro", {
      prompt: "stored run prompt",
      aspect_ratio: "4:3",
      output_format: "png",
      image: "https://example.com/outline.png",
    });
  });
});
