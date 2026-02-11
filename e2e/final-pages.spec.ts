import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";

function seedFinalPagesFixture() {
  const db = new Database("local.db");
  db.pragma("foreign_keys = ON");

  const suffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
  const ids = {
    storyId: `e2e-story-${suffix}`,
    sceneId: `e2e-scene-${suffix}`,
    panelId: `e2e-panel-${suffix}`,
    character1Id: `e2e-char1-${suffix}`,
    character2Id: `e2e-char2-${suffix}`,
    profile1Id: `e2e-profile1-${suffix}`,
    profile2Id: `e2e-profile2-${suffix}`,
    image1Id: `e2e-image1-${suffix}`,
    image2Id: `e2e-image2-${suffix}`,
    finalPage1Id: `e2e-final1-${suffix}`,
    finalPage2Id: `e2e-final2-${suffix}`,
  };

  db.prepare(
    "INSERT INTO characters (id, name, gender, style_preset, status) VALUES (?, ?, ?, ?, ?)"
  ).run(ids.character1Id, "Ava E2E", "female", "storybook", "ready");
  db.prepare(
    "INSERT INTO characters (id, name, gender, style_preset, status) VALUES (?, ?, ?, ?, ?)"
  ).run(ids.character2Id, "Eli E2E", "male", "storybook", "ready");

  db.prepare(
    "INSERT INTO character_profiles (id, character_id, clothing, color_palette, do_not_change) VALUES (?, ?, ?, ?, ?)"
  ).run(
    ids.profile1Id,
    ids.character1Id,
    "green coat",
    JSON.stringify(["green", "cream"]),
    JSON.stringify(["same face shape"])
  );
  db.prepare(
    "INSERT INTO character_profiles (id, character_id, clothing, color_palette, do_not_change) VALUES (?, ?, ?, ?, ?)"
  ).run(
    ids.profile2Id,
    ids.character2Id,
    "blue sweater",
    JSON.stringify(["blue", "orange"]),
    JSON.stringify(["same eye shape"])
  );

  db.prepare(
    "INSERT INTO character_images (id, character_id, image_url, is_selected) VALUES (?, ?, ?, ?)"
  ).run(ids.image1Id, ids.character1Id, "https://example.com/e2e-char1.png", 1);
  db.prepare(
    "INSERT INTO character_images (id, character_id, image_url, is_selected) VALUES (?, ?, ?, ?)"
  ).run(ids.image2Id, ids.character2Id, "https://example.com/e2e-char2.png", 1);

  db.prepare(
    "INSERT INTO stories (id, character_id, title, age_range, status) VALUES (?, ?, ?, ?, ?)"
  ).run(ids.storyId, ids.character1Id, "E2E Story", "6-8", "pages_ready");

  db.prepare(
    "INSERT INTO story_scenes (id, story_id, scene_number, spread_text, scene_description) VALUES (?, ?, ?, ?, ?)"
  ).run(
    ids.sceneId,
    ids.storyId,
    1,
    "A short spread text.",
    "A child walks through a lantern garden."
  );

  db.prepare(
    "INSERT INTO storyboard_panels (id, scene_id, composition, image_url, status) VALUES (?, ?, ?, ?, ?)"
  ).run(
    ids.panelId,
    ids.sceneId,
    "wide shot",
    "https://example.com/e2e-storyboard.png",
    "generated"
  );

  db.prepare(
    "INSERT INTO final_pages (id, scene_id, image_url, version, is_approved) VALUES (?, ?, ?, ?, ?)"
  ).run(ids.finalPage1Id, ids.sceneId, "https://example.com/e2e-final-v1.png", 1, 1);
  db.prepare(
    "INSERT INTO final_pages (id, scene_id, image_url, version, is_approved) VALUES (?, ?, ?, ?, ?)"
  ).run(ids.finalPage2Id, ids.sceneId, "https://example.com/e2e-final-v2.png", 2, 0);

  db.close();
  return ids;
}

function cleanupFinalPagesFixture(ids: ReturnType<typeof seedFinalPagesFixture>) {
  const db = new Database("local.db");
  db.pragma("foreign_keys = ON");

  db.prepare("DELETE FROM final_pages WHERE scene_id = ?").run(ids.sceneId);
  db.prepare("DELETE FROM storyboard_panels WHERE id = ?").run(ids.panelId);
  db.prepare("DELETE FROM story_scenes WHERE id = ?").run(ids.sceneId);
  db.prepare("DELETE FROM stories WHERE id = ?").run(ids.storyId);
  db.prepare("DELETE FROM character_images WHERE character_id IN (?, ?)").run(
    ids.character1Id,
    ids.character2Id
  );
  db.prepare("DELETE FROM character_profiles WHERE character_id IN (?, ?)").run(
    ids.character1Id,
    ids.character2Id
  );
  db.prepare("DELETE FROM characters WHERE id IN (?, ?)").run(
    ids.character1Id,
    ids.character2Id
  );
  db.close();
}

test("final pages UI supports bulk character selector and per-scene tabbed overrides", async ({
  page,
}) => {
  const ids = seedFinalPagesFixture();
  try {
    await page.goto(`/admin/stories/${ids.storyId}/pages`);

    await expect(
      page.getByRole("heading", { name: "Final Pages" })
    ).toBeVisible();
    await expect(
      page.getByText("Character for bulk generation")
    ).toBeVisible();

    // Switch to the second character in bulk selector.
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /Eli E2E/ }).click();

    // Verify scene card tabs are present.
    await expect(page.getByRole("tab", { name: "Images" }).first()).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Character + Prompt" }).first()
    ).toBeVisible();

    // Open prompt tab and switch per-scene character.
    await page.getByRole("tab", { name: "Character + Prompt" }).first().click();
    await page.locator('[id^="final-page-character-"]').first().click();
    await page.getByRole("option", { name: /Eli E2E/ }).click();

    // Open request preview and verify both storyboard + character references are included.
    await page.getByRole("button", { name: "Full request preview" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Full request preview" });
    await expect(dialog).toContainText('"image": [');
    await expect(dialog).toContainText("https://example.com/e2e-storyboard.png");
    await expect(dialog).toContainText("https://example.com/e2e-char2.png");
  } finally {
    cleanupFinalPagesFixture(ids);
  }
});
