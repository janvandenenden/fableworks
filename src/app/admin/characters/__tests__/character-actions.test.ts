import { describe, it, expect, vi, beforeEach } from "vitest";

const insertValues = vi.fn(async () => undefined);
const updateWhere = vi.fn(async () => undefined);
const updateSet = vi.fn(() => ({ where: updateWhere }));
const update = vi.fn(() => ({ set: updateSet }));
const deleteWhere = vi.fn(async () => undefined);
const deleteFn = vi.fn(() => ({ where: deleteWhere }));
const selectLimit = vi.fn(async () => [{ id: "char-1", sourceImageUrl: "https://example.com/img.png", stylePreset: "watercolor" }]);
const selectWhere = vi.fn(() => ({ limit: selectLimit }));
const select = vi.fn(() => ({ from: () => ({ where: selectWhere }) }));

const send = vi.fn(async () => ({ ids: ["event-id"] }));

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: insertValues })),
    update,
    delete: deleteFn,
    select,
  },
  schema: {
    characters: { id: "id" },
    characterImages: { characterId: "characterId", id: "id" },
    characterProfiles: { characterId: "characterId" },
    promptArtifacts: { entityId: "entityId" },
    generatedAssets: { entityId: "entityId" },
  },
}));

vi.mock("@/inngest/client", () => ({
  inngest: { send },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("character actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("regenerateCharacterFromModeAction sends an event", async () => {
    const { regenerateCharacterFromModeAction } = await import(
      "@/app/admin/characters/actions"
    );
    const formData = new FormData();
    formData.set("id", "char-1");
    formData.set("stylePreset", "default");
    formData.set("mode", "vision");

    await regenerateCharacterFromModeAction(formData);

    expect(send).toHaveBeenCalled();
  });

  it("deleteCharacterAction deletes related rows", async () => {
    const { deleteCharacterAction } = await import(
      "@/app/admin/characters/actions"
    );
    const formData = new FormData();
    formData.set("id", "char-1");

    await deleteCharacterAction(formData);

    expect(deleteFn).toHaveBeenCalled();
  });

  it("updateCharacterProfileAction upserts profile", async () => {
    const { db } = await import("@/db");
    const { updateCharacterProfileAction } = await import(
      "@/app/admin/characters/actions"
    );

    const insertSpy = db.insert as unknown as ReturnType<typeof vi.fn>;
    insertSpy.mockImplementationOnce(() => ({
      values: () => ({
        onConflictDoUpdate: async () => undefined,
      }),
    }));

    const formData = new FormData();
    formData.set("approxAge", "5");
    formData.set("hairColor", "brown");
    formData.set("colorPalette", "warm, pastel");
    formData.set("personalityTraits", "curious, kind");
    formData.set("doNotChange", "freckles");

    const result = await updateCharacterProfileAction("char-1", formData);
    expect(result.success).toBe(true);
  });
});
