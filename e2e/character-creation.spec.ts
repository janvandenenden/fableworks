import { test, expect } from "@playwright/test";
import path from "path";

test("create character without generation", async ({ page }) => {
  await page.route("**/api/upload", async (route) => {
    const json = {
      success: true,
      publicUrl:
        "https://example.com/uploads/anonymous/test-id/original.png",
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(json),
    });
  });

  await page.goto("/admin/characters");

  await page.getByLabel("Name").fill("Test Child");

  const filePath = path.join(process.cwd(), "public", "outline.png");
  await page.setInputFiles('input[type="file"]', filePath);

  await expect(page.getByText("Uploaded: original.png")).toBeVisible();

  await page.getByRole("button", { name: "Create" }).click();

  await expect(page).toHaveURL(/\/admin\/characters\/[0-9a-f-]+/);
  await expect(page.getByText("Details")).toBeVisible();
  await expect(page.getByText("Source image:")).toBeVisible();
});
