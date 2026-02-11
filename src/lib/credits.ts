import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";

export type GenerationOperation = "character_generation" | "final_page_generation";

const DEFAULT_STARTER_CREDITS_CENTS = 20;
const DEFAULT_CHARACTER_COST_CENTS = 4;
const DEFAULT_FINAL_PAGE_COST_CENTS = 4;
const DEFAULT_PAID_REROLL_CREDITS_CENTS = 20;

function newId(): string {
  return crypto.randomUUID();
}

function readPositiveCents(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.round(parsed);
}

export function getStarterCreditsCents(): number {
  return readPositiveCents(process.env.STARTER_CREDITS_CENTS, DEFAULT_STARTER_CREDITS_CENTS);
}

export function getGenerationCostCents(operation: GenerationOperation): number {
  if (operation === "character_generation") {
    return readPositiveCents(
      process.env.CREDIT_COST_CHARACTER_CENTS,
      DEFAULT_CHARACTER_COST_CENTS
    );
  }
  return readPositiveCents(
    process.env.CREDIT_COST_FINAL_PAGE_CENTS,
    DEFAULT_FINAL_PAGE_COST_CENTS
  );
}

function getDefaultPaidRerollCreditsCents(): number {
  return readPositiveCents(
    process.env.PAID_REROLL_CREDITS_CENTS,
    DEFAULT_PAID_REROLL_CREDITS_CENTS
  );
}

async function ensureUserExists(userId: string): Promise<void> {
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (rows.length > 0) return;

  await db.insert(schema.users).values({
    id: userId,
    email: `${userId}@placeholder.local`,
    role: "customer",
  });
}

async function getUserCreditsRow(userId: string) {
  const rows = await db
    .select()
    .from(schema.userCredits)
    .where(eq(schema.userCredits.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

async function ensureStarterCredits(userId: string): Promise<{ starterCreditsCents: number; paidCreditsCents: number }> {
  await ensureUserExists(userId);

  const existing = await getUserCreditsRow(userId);
  if (existing) {
    return {
      starterCreditsCents: existing.starterCreditsCents,
      paidCreditsCents: existing.paidCreditsCents,
    };
  }

  const starter = getStarterCreditsCents();
  await db.insert(schema.userCredits).values({
    userId,
    starterCreditsCents: starter,
    paidCreditsCents: 0,
  });

  await db.insert(schema.creditLedgerEntries).values({
    id: newId(),
    userId,
    entryType: "starter_grant",
    amountCents: starter,
    balanceStarterAfterCents: starter,
    balancePaidAfterCents: 0,
    metadata: JSON.stringify({ reason: "signup_starter_pack" }),
  });

  return { starterCreditsCents: starter, paidCreditsCents: 0 };
}

async function hasPaidOrder(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(and(eq(schema.orders.userId, userId), eq(schema.orders.paymentStatus, "paid")))
    .limit(1);
  return rows.length > 0;
}

export async function getUserCreditSnapshot(userId: string): Promise<{
  starterCreditsCents: number;
  paidCreditsCents: number;
  hasPaidOrder: boolean;
}> {
  const row = await getUserCreditsRow(userId);
  return {
    starterCreditsCents: row?.starterCreditsCents ?? 0,
    paidCreditsCents: row?.paidCreditsCents ?? 0,
    hasPaidOrder: await hasPaidOrder(userId),
  };
}

export type ConsumeGenerationCreditResult =
  | {
      success: true;
      source: "starter" | "paid";
      remainingStarterCents: number;
    }
  | {
      success: false;
      error: string;
      remainingStarterCents: number;
    };

export async function consumeGenerationCreditForUser(input: {
  userId: string;
  operation: GenerationOperation;
  metadata?: Record<string, unknown>;
}): Promise<ConsumeGenerationCreditResult> {
  const { userId, operation, metadata } = input;
  const seeded = await ensureStarterCredits(userId);

  if (await hasPaidOrder(userId)) {
    return {
      success: true,
      source: "paid",
      remainingStarterCents: seeded.starterCreditsCents,
    };
  }

  const costCents = getGenerationCostCents(operation);

  const updateResult = await db
    .update(schema.userCredits)
    .set({
      starterCreditsCents: sql`${schema.userCredits.starterCreditsCents} - ${costCents}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.userCredits.userId, userId),
        gte(schema.userCredits.starterCreditsCents, costCents)
      )
    );

  const changed =
    typeof (updateResult as { changes?: number }).changes === "number"
      ? (updateResult as { changes: number }).changes
      : 0;

  const updated = await getUserCreditsRow(userId);
  const remaining = updated?.starterCreditsCents ?? seeded.starterCreditsCents;

  if (changed === 0 || !updated) {
    return {
      success: false,
      error: `Insufficient starter credits. Remaining: $${(remaining / 100).toFixed(2)}. Please purchase before generating more content.`,
      remainingStarterCents: remaining,
    };
  }

  await db.insert(schema.creditLedgerEntries).values({
    id: newId(),
    userId,
    entryType: "generation_debit",
    amountCents: -costCents,
    balanceStarterAfterCents: updated.starterCreditsCents,
    balancePaidAfterCents: updated.paidCreditsCents,
    metadata: JSON.stringify({ operation, ...(metadata ?? {}) }),
  });

  return {
    success: true,
    source: "starter",
    remainingStarterCents: updated.starterCreditsCents,
  };
}

export async function grantPaidRerollCreditsForOrder(input: {
  userId: string;
  orderId: string;
  amountCents?: number;
}): Promise<void> {
  const { userId, orderId } = input;
  const amountCents = input.amountCents ?? getDefaultPaidRerollCreditsCents();
  await ensureStarterCredits(userId);

  const idempotencyKey = `paid-credit:${orderId}`;
  const existingGrantRows = await db
    .select({ id: schema.creditLedgerEntries.id })
    .from(schema.creditLedgerEntries)
    .where(eq(schema.creditLedgerEntries.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existingGrantRows.length > 0) {
    return;
  }

  await db
    .update(schema.userCredits)
    .set({
      paidCreditsCents: sql`${schema.userCredits.paidCreditsCents} + ${amountCents}`,
      updatedAt: new Date(),
    })
    .where(eq(schema.userCredits.userId, userId));

  const updated = await getUserCreditsRow(userId);
  await db.insert(schema.creditLedgerEntries).values({
    id: newId(),
    userId,
    orderId,
    entryType: "paid_grant",
    amountCents,
    balanceStarterAfterCents: updated?.starterCreditsCents ?? null,
    balancePaidAfterCents: updated?.paidCreditsCents ?? null,
    idempotencyKey,
    metadata: JSON.stringify({ reason: "post_purchase_reroll_pack" }),
  });
}
