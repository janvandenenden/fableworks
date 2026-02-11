import { beforeEach, describe, expect, it, vi } from "vitest";

const constructEvent = vi.fn();
const updateWhere = vi.fn(async () => undefined);
const updateSet = vi.fn(() => ({ where: updateWhere }));
const update = vi.fn(() => ({ set: updateSet }));
const insertValues = vi.fn(async () => undefined);
const selectLimit = vi.fn(async () => []);
const grantPaidRerollCreditsForOrder = vi.fn(async () => undefined);

const select = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => ({
      limit: selectLimit,
    })),
  })),
}));

vi.mock("@/db", () => ({
  db: {
    select,
    update,
    insert: vi.fn(() => ({ values: insertValues })),
  },
  schema: {
    orders: {
      id: "id",
      stripeCheckoutSessionId: "stripeCheckoutSessionId",
      stripePaymentIntentId: "stripePaymentIntentId",
    },
    books: {
      orderId: "orderId",
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    webhooks: {
      constructEvent,
    },
  }),
  getStripeWebhookSecret: () => "whsec_test",
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
}));

vi.mock("@/lib/credits", () => ({
  grantPaidRerollCreditsForOrder,
}));

describe("stripe webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when stripe signature header is missing", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");

    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
      })
    );

    expect(response.status).toBe(400);
  });

  it("marks order paid and creates a pending_generation book", async () => {
    const sessionId = "cs_test_123";
    constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          payment_intent: "pi_test_123",
          metadata: { orderId: "order-1" },
        },
      },
    });

    selectLimit
      .mockResolvedValueOnce([{ id: "order-1", userId: "user-1" }])
      .mockResolvedValueOnce([]);

    const { POST } = await import("@/app/api/webhooks/stripe/route");

    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
        },
        body: "{}",
      })
    );

    expect(response.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentStatus: "paid",
        stripeCheckoutSessionId: sessionId,
        stripePaymentIntentId: "pi_test_123",
      })
    );
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        printStatus: "pending_generation",
      })
    );
    expect(grantPaidRerollCreditsForOrder).toHaveBeenCalledWith({
      userId: "user-1",
      orderId: "order-1",
    });
  });

  it("marks checkout session as expired", async () => {
    constructEvent.mockReturnValue({
      type: "checkout.session.expired",
      data: {
        object: {
          id: "cs_expired_1",
        },
      },
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");

    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
        },
        body: "{}",
      })
    );

    expect(response.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith({ paymentStatus: "expired" });
  });
});
