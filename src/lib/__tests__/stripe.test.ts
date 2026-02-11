import { afterEach, describe, expect, it, vi } from "vitest";

function withEnv(patch: Record<string, string | undefined>) {
  const original: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(patch)) {
    original[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return () => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

describe("stripe helpers", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("prefers price id checkout mode when configured", async () => {
    const restore = withEnv({ STRIPE_PRICE_ID_TEST: "price_test_123" });
    const { getCheckoutPriceConfig } = await import("@/lib/stripe");

    expect(getCheckoutPriceConfig()).toEqual({
      mode: "price_id",
      priceId: "price_test_123",
    });

    restore();
  });

  it("returns normalized app base URL without trailing slash", async () => {
    const restore = withEnv({ NEXT_PUBLIC_APP_URL: "https://fableworks.example/" });
    const { getAppBaseUrl } = await import("@/lib/stripe");

    expect(getAppBaseUrl()).toBe("https://fableworks.example");

    restore();
  });

  it("throws when inline checkout cents are invalid", async () => {
    const restore = withEnv({
      STRIPE_PRICE_ID_TEST: undefined,
      BOOK_PRICE_CENTS: "0",
    });
    const { getCheckoutPriceConfig } = await import("@/lib/stripe");

    expect(() => getCheckoutPriceConfig()).toThrow("BOOK_PRICE_CENTS must be a positive integer");

    restore();
  });
});
