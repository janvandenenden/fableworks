import { test, expect } from "@playwright/test";
import Database from "better-sqlite3";

function seedCustomerPaidFlowFixture() {
  const db = new Database("local.db");
  db.pragma("foreign_keys = ON");

  const suffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
  const ids = {
    userId: "dev-user",
    storyId: `e2e-paid-story-${suffix}`,
    orderId: `e2e-paid-order-${suffix}`,
    bookId: `e2e-paid-book-${suffix}`,
    sessionId: `cs_test_${suffix}`,
    pipelineId: `e2e-pipeline-${suffix}`,
    interiorAssetId: `e2e-int-${suffix}`,
    coverAssetId: `e2e-cover-${suffix}`,
  };

  db.prepare("INSERT OR IGNORE INTO users (id, email, role) VALUES (?, ?, ?)").run(
    ids.userId,
    "dev-user@local.fableworks",
    "customer"
  );
  db.prepare(
    "INSERT INTO stories (id, user_id, title, age_range, status) VALUES (?, ?, ?, ?, ?)"
  ).run(ids.storyId, ids.userId, "Paid Story E2E", "6-8", "pages_ready");
  db.prepare(
    "INSERT INTO orders (id, user_id, story_id, stripe_checkout_session_id, payment_status, amount_cents, currency, shipping_name, shipping_email, shipping_address_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    ids.orderId,
    ids.userId,
    ids.storyId,
    ids.sessionId,
    "paid",
    2999,
    "usd",
    "E2E Buyer",
    "buyer@example.com",
    JSON.stringify({
      line1: "Main St 1",
      city: "Brussels",
      postal_code: "1000",
      country: "BE",
    })
  );
  db.prepare(
    "INSERT INTO books (id, order_id, pdf_url, print_status, tracking_url) VALUES (?, ?, ?, ?, ?)"
  ).run(
    ids.bookId,
    ids.orderId,
    "https://example.com/e2e-interior.pdf",
    "pdf_ready",
    null
  );
  db.prepare(
    "INSERT INTO prompt_artifacts (id, entity_type, entity_id, raw_prompt, model, status, structured_fields) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    ids.pipelineId,
    "order_generation_pipeline",
    ids.orderId,
    "e2e pipeline",
    "internal-pipeline",
    "success",
    JSON.stringify({ stage: "complete" })
  );
  db.prepare(
    "INSERT INTO generated_assets (id, type, entity_id, storage_url, mime_type) VALUES (?, ?, ?, ?, ?)"
  ).run(
    ids.interiorAssetId,
    "book_pdf_interior",
    ids.bookId,
    "https://example.com/e2e-interior.pdf",
    "application/pdf"
  );
  db.prepare(
    "INSERT INTO generated_assets (id, type, entity_id, storage_url, mime_type) VALUES (?, ?, ?, ?, ?)"
  ).run(
    ids.coverAssetId,
    "book_pdf_cover",
    ids.bookId,
    "https://example.com/e2e-cover.pdf",
    "application/pdf"
  );

  db.close();
  return ids;
}

function cleanupCustomerPaidFlowFixture(ids: ReturnType<typeof seedCustomerPaidFlowFixture>) {
  const db = new Database("local.db");
  db.pragma("foreign_keys = ON");

  db.prepare("DELETE FROM generated_assets WHERE id IN (?, ?)").run(
    ids.interiorAssetId,
    ids.coverAssetId
  );
  db.prepare("DELETE FROM prompt_artifacts WHERE id = ?").run(ids.pipelineId);
  db.prepare("DELETE FROM books WHERE id = ?").run(ids.bookId);
  db.prepare("DELETE FROM orders WHERE id = ?").run(ids.orderId);
  db.prepare("DELETE FROM stories WHERE id = ?").run(ids.storyId);
  db.close();
}

test("customer sees clean post-payment flow and account tracking", async ({ page }) => {
  const ids = seedCustomerPaidFlowFixture();
  try {
    await page.goto(`/create/success?session_id=${ids.sessionId}`);

    await expect(
      page.getByRole("heading", { name: "You did it. Your book is in motion." })
    ).toBeVisible();
    await page.getByRole("link", { name: "Track My Order" }).click();

    await expect(page).toHaveURL(/\/books$/);
    await expect(page.getByText("Paid Story E2E")).toBeVisible();
    await page.locator(`a[href="/books/${ids.bookId}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/books/${ids.bookId}$`));
    await expect(page.getByText("Shipping")).toBeVisible();
    await expect(page.getByText("E2E Buyer")).toBeVisible();
    await expect(page.getByText("Processing complete")).toBeVisible();
  } finally {
    cleanupCustomerPaidFlowFixture(ids);
  }
});
