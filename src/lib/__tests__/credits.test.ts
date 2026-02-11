import { beforeEach, describe, expect, it, vi } from "vitest";

const insertValues = vi.fn(async () => undefined);
const updateWhere = vi.fn(async () => ({ changes: 1 }));
const updateSet = vi.fn(() => ({ where: updateWhere }));
const update = vi.fn(() => ({ set: updateSet }));

const selectLimit = vi.fn(async () => []);
const selectWhere = vi.fn(() => ({ limit: selectLimit }));
const selectFrom = vi.fn(() => ({ where: selectWhere }));
const select = vi.fn(() => ({ from: selectFrom }));

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: insertValues })),
    update,
    select,
  },
  schema: {
    users: { __table: "users", id: "id" },
    orders: { __table: "orders", id: "id", userId: "userId", paymentStatus: "paymentStatus" },
    userCredits: {
      __table: "user_credits",
      userId: "userId",
      starterCreditsCents: "starterCreditsCents",
      paidCreditsCents: "paidCreditsCents",
    },
    creditLedgerEntries: { __table: "credit_ledger_entries", id: "id", idempotencyKey: "idempotencyKey" },
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  sql: vi.fn((strings: TemplateStringsArray) => strings.join("?")),
}));

describe("credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STARTER_CREDITS_CENTS;
    delete process.env.CREDIT_COST_CHARACTER_CENTS;
    delete process.env.CREDIT_COST_FINAL_PAGE_CENTS;
  });

  it("consumes starter credits for generation", async () => {
    selectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ starterCreditsCents: 16, paidCreditsCents: 0 }]);
    updateWhere.mockResolvedValueOnce({ changes: 1 });

    const { consumeGenerationCreditForUser } = await import("@/lib/credits");
    const result = await consumeGenerationCreditForUser({
      userId: "user-1",
      operation: "character_generation",
      metadata: { characterId: "char-1" },
    });

    expect(result).toEqual({
      success: true,
      source: "starter",
      remainingStarterCents: 16,
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1", email: "user-1@placeholder.local" })
    );
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", starterCreditsCents: 20 })
    );
  });

  it("rejects generation when starter credits are exhausted and no paid order exists", async () => {
    selectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ starterCreditsCents: 2, paidCreditsCents: 0 }]);
    updateWhere.mockResolvedValueOnce({ changes: 0 });

    const { consumeGenerationCreditForUser } = await import("@/lib/credits");
    const result = await consumeGenerationCreditForUser({
      userId: "user-1",
      operation: "final_page_generation",
    });

    expect(result.success).toBe(false);
    expect(result).toEqual(
      expect.objectContaining({ remainingStarterCents: 2 })
    );
  });

  it("allows generation without starter debit when user already paid", async () => {
    selectLimit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "order-1" }]);

    const { consumeGenerationCreditForUser } = await import("@/lib/credits");
    const result = await consumeGenerationCreditForUser({
      userId: "user-1",
      operation: "character_generation",
    });

    expect(result).toEqual({
      success: true,
      source: "paid",
      remainingStarterCents: 20,
    });
  });
});
