import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

type Milestone = "processing_complete" | "printing" | "shipped";

function notificationId(orderId: string, milestone: Milestone): string {
  return `email:${orderId}:${milestone}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /unique constraint|primary key/i.test(error.message);
}

async function reserveNotification(orderId: string, milestone: Milestone): Promise<boolean> {
  try {
    await db.insert(schema.promptArtifacts).values({
      id: notificationId(orderId, milestone),
      entityType: "email_notification",
      entityId: orderId,
      rawPrompt: milestone,
      model: "resend",
      status: "running",
      parameters: JSON.stringify({ milestone }),
    });
    return true;
  } catch (error) {
    if (isUniqueConstraintError(error)) return false;
    throw error;
  }
}

async function markNotification(orderId: string, milestone: Milestone, status: "success" | "failed", error?: string) {
  await db
    .update(schema.promptArtifacts)
    .set({
      status,
      errorMessage: error ?? null,
    })
    .where(eq(schema.promptArtifacts.id, notificationId(orderId, milestone)));
}

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  return {
    apiKey: apiKey || null,
    from: from || null,
  };
}

function messageForMilestone(input: {
  milestone: Milestone;
  storyTitle: string;
  trackingUrl?: string | null;
}) {
  switch (input.milestone) {
    case "processing_complete":
      return {
        subject: `Your book "${input.storyTitle}" is ready for print`,
        text: `Great news: your personalized book "${input.storyTitle}" finished processing and is now queued for printing.`,
      };
    case "printing":
      return {
        subject: `Your book "${input.storyTitle}" is now printing`,
        text: `Update: your personalized book "${input.storyTitle}" is currently in production.`,
      };
    case "shipped":
      return {
        subject: `Your book "${input.storyTitle}" has shipped`,
        text: input.trackingUrl
          ? `Your personalized book "${input.storyTitle}" is on the way. Tracking: ${input.trackingUrl}`
          : `Your personalized book "${input.storyTitle}" is on the way.`,
      };
  }
}

export async function sendOrderMilestoneEmail(input: {
  orderId: string;
  milestone: Milestone;
  trackingUrl?: string | null;
}): Promise<void> {
  const { orderId, milestone } = input;
  const reserved = await reserveNotification(orderId, milestone);
  if (!reserved) return;

  const config = getEmailConfig();
  if (!config.apiKey || !config.from) {
    await markNotification(orderId, milestone, "success");
    return;
  }

  try {
    const rows = await db
      .select({
        shippingEmail: schema.orders.shippingEmail,
        userId: schema.orders.userId,
        storyTitle: schema.stories.title,
        userEmail: schema.users.email,
      })
      .from(schema.orders)
      .leftJoin(schema.stories, eq(schema.orders.storyId, schema.stories.id))
      .leftJoin(schema.users, eq(schema.orders.userId, schema.users.id))
      .where(eq(schema.orders.id, orderId))
      .limit(1);

    const row = rows[0];
    const to = row?.shippingEmail?.trim() || row?.userEmail?.trim() || null;
    if (!to) {
      await markNotification(orderId, milestone, "success");
      return;
    }

    const storyTitle = row?.storyTitle?.trim() || "your book";
    const message = messageForMilestone({
      milestone,
      storyTitle,
      trackingUrl: input.trackingUrl,
    });

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [to],
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend error ${response.status}: ${body}`);
    }

    await markNotification(orderId, milestone, "success");
  } catch (error) {
    await markNotification(
      orderId,
      milestone,
      "failed",
      error instanceof Error ? error.message : "Failed to send email"
    );
  }
}

export async function sendPrintStatusMilestoneIfNeeded(input: {
  orderId: string;
  previousStatus: string | null | undefined;
  nextStatus: string | null | undefined;
  trackingUrl?: string | null;
}): Promise<void> {
  const previous = input.previousStatus ?? null;
  const next = input.nextStatus ?? null;
  if (previous === next) return;

  if (next === "in_production") {
    await sendOrderMilestoneEmail({ orderId: input.orderId, milestone: "printing" });
    return;
  }
  if (next === "shipped") {
    await sendOrderMilestoneEmail({
      orderId: input.orderId,
      milestone: "shipped",
      trackingUrl: input.trackingUrl ?? null,
    });
  }
}
