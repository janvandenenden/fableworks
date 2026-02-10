import { test, expect } from "@playwright/test";

test.describe("Admin Playground", () => {
  test("page loads with correct heading", async ({ page }) => {
    await page.goto("/admin/playground");
    await expect(page.getByRole("heading", { name: "Playground" })).toBeVisible();
  });

  test("has model selector with three options", async ({ page }) => {
    await page.goto("/admin/playground");
    await page.getByRole("combobox").click();
    await expect(page.getByRole("option", { name: /OpenAI Text/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /OpenAI Vision/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /Replicate/i })).toBeVisible();
  });

  test("generate button is disabled when prompt is empty", async ({ page }) => {
    await page.goto("/admin/playground");
    const generateButton = page.getByRole("button", { name: /Generate/i });
    await expect(generateButton).toBeDisabled();
  });

  test("generate button enables when prompt has text", async ({ page }) => {
    await page.goto("/admin/playground");
    await page.getByLabel("Prompt").fill("Test prompt");
    const generateButton = page.getByRole("button", { name: /Generate/i });
    await expect(generateButton).toBeEnabled();
  });

  test("shows image URL input only in vision mode", async ({ page }) => {
    await page.goto("/admin/playground");

    // Not visible in text mode
    await expect(page.getByLabel("Image URL")).not.toBeVisible();

    // Switch to vision mode
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: /OpenAI Vision/i }).click();

    // Now visible
    await expect(page.getByLabel("Image URL")).toBeVisible();
  });
});
