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
    stories: {
      __table: "stories",
      id: "id",
      status: "status",
      characterId: "characterId",
    },
    storyScenes: {
      __table: "story_scenes",
      id: "id",
      storyId: "storyId",
      sceneNumber: "sceneNumber",
      spreadText: "spreadText",
      sceneDescription: "sceneDescription",
    },
    storyboardPanels: {
      __table: "storyboard_panels",
      sceneId: "sceneId",
      imageUrl: "imageUrl",
      composition: "composition",
      background: "background",
      foreground: "foreground",
      environment: "environment",
      characterPose: "characterPose",
    },
    characters: {
      __table: "characters",
      id: "id",
      stylePreset: "stylePreset",
      name: "name",
    },
    characterImages: {
      __table: "character_images",
      characterId: "characterId",
      isSelected: "isSelected",
      imageUrl: "imageUrl",
    },
    characterProfiles: {
      __table: "character_profiles",
      characterId: "characterId",
      approxAge: "approxAge",
      hairColor: "hairColor",
      hairLength: "hairLength",
      hairTexture: "hairTexture",
      hairStyle: "hairStyle",
      faceShape: "faceShape",
      eyeColor: "eyeColor",
      eyeShape: "eyeShape",
      skinTone: "skinTone",
      clothing: "clothing",
      distinctiveFeatures: "distinctiveFeatures",
      colorPalette: "colorPalette",
      doNotChange: "doNotChange",
    },
    propsBibleEntries: {
      __table: "props_bible_entries",
      storyId: "storyId",
      title: "title",
      description: "description",
      appearsInScenes: "appearsInScenes",
    },
    finalPages: {
      __table: "final_pages",
      id: "id",
      sceneId: "sceneId",
      version: "version",
      isApproved: "isApproved",
      imageUrl: "imageUrl",
      createdAt: "createdAt",
    },
    promptArtifacts: {
      __table: "prompt_artifacts",
      id: "id",
      entityId: "entityId",
      entityType: "entityType",
      parameters: "parameters",
      structuredFields: "structuredFields",
    },
    generatedAssets: {
      __table: "generated_assets",
      id: "id",
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
  asc: vi.fn(() => ({})),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prompts/final-page", async () => {
  const actual = await vi.importActual<typeof import("@/lib/prompts/final-page")>(
    "@/lib/prompts/final-page"
  );
  return {
    ...actual,
    buildFinalPagePrompt: vi.fn(() => "final page prompt"),
  };
});

vi.mock("@/lib/replicate", () => ({
  MODELS: { nanoBanana: "model-nano" },
  createPrediction: vi.fn(async () => ({ id: "pred-1", status: "succeeded" })),
  getReplicateClient: vi.fn(() => ({
    predictions: {
      get: vi.fn(async () => ({
        status: "succeeded",
        output: "https://replicate.example/final.png",
      })),
    },
  })),
  extractImageUrl: vi.fn(() => "https://replicate.example/final.png"),
}));

vi.mock("@/lib/r2", () => ({
  copyFromTempUrl: vi.fn(async () => "https://r2.example/final.png"),
}));

const STORY_ID = "00000000-0000-4000-8000-000000000001";
const SCENE_ID = "00000000-0000-4000-8000-000000000002";
const RUN_ID = "00000000-0000-4000-8000-000000000003";
const PAGE_ID = "00000000-0000-4000-8000-000000000004";
const CHARACTER_ID = "00000000-0000-4000-8000-000000000005";

function seedCommonRows() {
  setRows("stories", [{ id: STORY_ID, characterId: null }]);
  setRows("story_scenes", [
    {
      id: SCENE_ID,
      storyId: STORY_ID,
      sceneNumber: 1,
      spreadText: "Spread text",
      sceneDescription: "Scene description",
    },
  ]);
  setRows("storyboard_panels", [
    {
      sceneId: SCENE_ID,
      imageUrl: "https://r2.example/storyboard.png",
      composition: "wide",
      background: "bg",
      foreground: "fg",
      environment: "env",
      characterPose: "pose",
    },
  ]);
  setRows("characters", [
    { id: CHARACTER_ID, stylePreset: "storybook", name: "Ava" },
  ]);
  setRows("character_images", [
    { characterId: CHARACTER_ID, isSelected: true, imageUrl: "https://r2.example/char.png" },
  ]);
  setRows("character_profiles", [
    {
      characterId: CHARACTER_ID,
      approxAge: "young_child",
      hairColor: "brown",
      hairLength: "short",
      hairTexture: "wavy",
      hairStyle: "bob",
      faceShape: "round",
      eyeColor: "green",
      eyeShape: "round",
      skinTone: "light",
      clothing: "green coat",
      distinctiveFeatures: "freckles",
      colorPalette: JSON.stringify(["green", "cream"]),
      doNotChange: JSON.stringify(["face shape", "hair texture"]),
    },
  ]);
  setRows("props_bible_entries", []);
  setRows("final_pages", []);
  setRows("prompt_artifacts", []);
}

describe("final page actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRows();
    seedCommonRows();
  });

  it("generateFinalPageAction supports character override and sends storyboard+character images", async () => {
    const { createPrediction } = await import("@/lib/replicate");
    const createPredictionMock = createPrediction as unknown as ReturnType<typeof vi.fn>;
    const { generateFinalPageAction } = await import(
      "@/app/admin/stories/[id]/pages/actions"
    );

    const formData = new FormData();
    formData.set("storyId", STORY_ID);
    formData.set("sceneId", SCENE_ID);
    formData.set("characterId", CHARACTER_ID);

    const result = await generateFinalPageAction(formData);

    expect(result.success).toBe(true);
    expect(createPredictionMock).toHaveBeenCalledWith(
      "model-nano",
      expect.objectContaining({
        image_input: ["https://r2.example/storyboard.png", "https://r2.example/char.png"],
        image: ["https://r2.example/storyboard.png", "https://r2.example/char.png"],
      })
    );
  });

  it("saveFinalPagePromptDraftAction stores character context and dual-image payload", async () => {
    const { saveFinalPagePromptDraftAction } = await import(
      "@/app/admin/stories/[id]/pages/actions"
    );

    const formData = new FormData();
    formData.set("storyId", STORY_ID);
    formData.set("sceneId", SCENE_ID);
    formData.set("characterId", CHARACTER_ID);
    formData.set("promptOverride", "Draft prompt");

    const result = await saveFinalPagePromptDraftAction(formData);

    expect(result.success).toBe(true);
    const inserted = insertValues.mock.calls
      .map((call) => call[0])
      .find((row) => row?.entityType === "final_page_prompt_draft");
    expect(inserted).toBeTruthy();
    expect(inserted).toEqual(
      expect.objectContaining({
        entityType: "final_page_prompt_draft",
        rawPrompt: "Draft prompt",
        parameters: expect.objectContaining({
          image_input: ["https://r2.example/storyboard.png", "https://r2.example/char.png"],
          image: ["https://r2.example/storyboard.png", "https://r2.example/char.png"],
        }),
      })
    );
    expect(() => JSON.parse(String(inserted.structuredFields))).not.toThrow();
  });

  it("generateFinalPageFromRunAction rejects invalid run artifact type", async () => {
    setRows("prompt_artifacts", [
      {
        id: RUN_ID,
        entityType: "final_page_prompt_draft",
        entityId: SCENE_ID,
        parameters: {
          prompt: "stored",
          aspect_ratio: "4:3",
          output_format: "png",
          image_input: ["https://r2.example/storyboard.png", "https://r2.example/char.png"],
          image: ["https://r2.example/storyboard.png", "https://r2.example/char.png"],
        },
      },
    ]);

    const { generateFinalPageFromRunAction } = await import(
      "@/app/admin/stories/[id]/pages/actions"
    );
    const formData = new FormData();
    formData.set("storyId", STORY_ID);
    formData.set("sceneId", SCENE_ID);
    formData.set("runArtifactId", RUN_ID);

    const result = await generateFinalPageFromRunAction(formData);

    expect(result).toEqual({
      success: false,
      error: "Invalid run artifact type",
    });
  });

  it("approveFinalPageVersionAction unapproves scene versions then applies selection", async () => {
    setRows("final_pages", [{ id: PAGE_ID, sceneId: SCENE_ID }]);
    const { approveFinalPageVersionAction } = await import(
      "@/app/admin/stories/[id]/pages/actions"
    );

    const formData = new FormData();
    formData.set("storyId", STORY_ID);
    formData.set("finalPageId", PAGE_ID);
    formData.set("approved", "true");

    const result = await approveFinalPageVersionAction(formData);

    expect(result.success).toBe(true);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ isApproved: false }));
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ isApproved: true }));
  });

  it("generateFinalPagesAction bulk mode sets generating then ready", async () => {
    const { generateFinalPagesAction } = await import(
      "@/app/admin/stories/[id]/pages/actions"
    );
    const formData = new FormData();
    formData.set("storyId", STORY_ID);
    formData.set("characterId", CHARACTER_ID);

    const result = await generateFinalPagesAction(formData);

    expect(result.success).toBe(true);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "pages_generating" }));
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "pages_ready" }));
  });
});
