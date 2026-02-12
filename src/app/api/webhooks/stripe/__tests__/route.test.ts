import { beforeEach, describe, expect, it, vi } from "vitest";

const constructEvent = vi.fn();
const updateWhere = vi.fn(async () => undefined);
const updateSet = vi.fn(() => ({ where: updateWhere }));
const update = vi.fn(() => ({ set: updateSet }));
const insertValues = vi.fn(async () => undefined);
const selectLimit = vi.fn(async () => []);
const grantPaidRerollCreditsForOrder = vi.fn(async () => undefined);
const inngestSend = vi.fn(async () => undefined);

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
      paymentStatus: "paymentStatus",
    },
    books: {
      orderId: "orderId",
    },
    promptArtifacts: {
      id: "id",
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
  and: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
}));

vi.mock("@/lib/credits", () => ({
  grantPaidRerollCreditsForOrder,
}));

vi.mock("@/inngest/client", () => ({
  inngest: {
    send: inngestSend,
  },
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
      id: "evt_paid_1",
      type: "checkout.session.completed",
      livemode: false,
      created: 1_735_000_001,
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
    expect(inngestSend).toHaveBeenCalledWith({
      name: "order/paid",
      data: { orderId: "order-1" },
    });
  });

  it("skips duplicate webhook events idempotently", async () => {
    constructEvent.mockReturnValue({
      id: "evt_duplicate",
      type: "checkout.session.completed",
      livemode: false,
      created: 1_735_000_000,
      data: {
        object: {
          id: "cs_test_duplicate",
          payment_intent: "pi_test_duplicate",
          metadata: { orderId: "order-1" },
        },
      },
    });

    insertValues.mockRejectedValueOnce(new Error("UNIQUE constraint failed: prompt_artifacts.id"));

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
    expect(updateSet).not.toHaveBeenCalled();
    expect(grantPaidRerollCreditsForOrder).not.toHaveBeenCalled();
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("marks checkout session as expired", async () => {
    constructEvent.mockReturnValue({
      id: "evt_expired_1",
      type: "checkout.session.expired",
      livemode: false,
      created: 1_735_000_002,
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
