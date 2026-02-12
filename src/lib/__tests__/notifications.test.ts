import { beforeEach, describe, expect, it, vi } from "vitest";

const insertValues = vi.fn(async () => undefined);
const updateWhere = vi.fn(async () => undefined);
const updateSet = vi.fn(() => ({ where: updateWhere }));
const update = vi.fn(() => ({ set: updateSet }));

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: insertValues })),
    update,
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        })),
      })),
    })),
  },
  schema: {
    promptArtifacts: {
      id: "id",
    },
    orders: {
      id: "id",
      storyId: "storyId",
      userId: "userId",
      shippingEmail: "shippingEmail",
    },
    stories: {
      id: "id",
      title: "title",
    },
    users: {
      id: "id",
      email: "email",
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
}));

describe("notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  it("silently skips duplicate milestone reservation", async () => {
    insertValues.mockRejectedValueOnce(new Error("UNIQUE constraint failed: prompt_artifacts.id"));
    const { sendOrderMilestoneEmail } = await import("@/lib/notifications");

    await expect(
      sendOrderMilestoneEmail({ orderId: "order-1", milestone: "processing_complete" })
    ).resolves.toBeUndefined();
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("marks notification success when email provider is not configured", async () => {
    const { sendOrderMilestoneEmail } = await import("@/lib/notifications");

    await expect(
      sendOrderMilestoneEmail({ orderId: "order-2", milestone: "printing" })
    ).resolves.toBeUndefined();
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
      })
    );
  });
});
