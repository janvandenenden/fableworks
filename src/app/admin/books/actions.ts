"use server";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { inngest } from "@/inngest/client";
import {
  generateBookCoverPdfBuffer,
  generateBookInteriorPdfBuffer,
} from "@/lib/pdf/generate-book-pdf";
import { uploadToR2 } from "@/lib/r2";
import {
  MANUAL_PRINT_STATUSES,
  createLuluPrintJob,
  getLuluConfigValidationErrors,
  getLuluPrintJob,
  mapLuluStatusToInternal,
  normalizeManualPrintStatus,
  type ManualPrintStatus,
} from "@/lib/lulu";
import { sendPrintStatusMilestoneIfNeeded } from "@/lib/notifications";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const generatePdfSchema = z.object({
  storyId: z.string().uuid(),
});

const updateManualPrintSchema = z.object({
  bookId: z.string().uuid(),
  luluPrintJobId: z.string().trim().max(191).optional(),
  printStatus: z.enum(MANUAL_PRINT_STATUSES).optional(),
  trackingUrl: z.string().trim().max(1000).optional(),
});
const bookIdSchema = z.object({
  bookId: z.string().uuid(),
});

function newId(): string {
  return crypto.randomUUID();
}

const BOOK_INTERIOR_ASSET_TYPE = "book_pdf_interior";
const BOOK_COVER_ASSET_TYPE = "book_pdf_cover";
const LULU_SUBMIT_ENTITY_TYPE = "lulu_print_submit";
const LULU_REFRESH_ENTITY_TYPE = "lulu_print_status_refresh";

function normalizeDateInput(value: Date | string | number | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const ms = value < 10_000_000_000 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (/^\d+$/.test(value)) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      const ms = asNumber < 10_000_000_000 ? asNumber * 1000 : asNumber;
      const dateFromDigits = new Date(ms);
      if (!Number.isNaN(dateFromDigits.getTime())) return dateFromDigits;
    }
  }
  const normalized =
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
      ? value.replace(" ", "T") + "Z"
      : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toSortTimestamp(value: Date | string | number | null | undefined): number {
  return normalizeDateInput(value)?.getTime() ?? 0;
}

async function getOrCreateInternalBookForStory(storyId: string) {
  const storyRows = await db
    .select({ id: schema.stories.id, userId: schema.stories.userId })
    .from(schema.stories)
    .where(eq(schema.stories.id, storyId))
    .limit(1);
  const story = storyRows[0];
  if (!story) {
    throw new Error("Story not found");
  }

  const orderRows = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.storyId, storyId))
    .orderBy(desc(schema.orders.createdAt))
    .limit(1);

  const order =
    orderRows[0] ??
    (
      await db
        .insert(schema.orders)
        .values({
          id: newId(),
          userId: story.userId,
          storyId,
          paymentStatus: "internal",
          amountCents: 0,
          currency: "usd",
        })
        .returning()
    )[0];

  const bookRows = await db
    .select()
    .from(schema.books)
    .where(eq(schema.books.orderId, order.id))
    .orderBy(desc(schema.books.createdAt))
    .limit(1);

  const book =
    bookRows[0] ??
    (
      await db
        .insert(schema.books)
        .values({
          id: newId(),
          orderId: order.id,
          printStatus: "draft",
        })
        .returning()
    )[0];

  return { story, order, book };
}

export async function generateBookPdfAction(formData: FormData): Promise<ActionResult<{ bookId: string }>> {
  const parsed = generatePdfSchema.safeParse({
    storyId: formData.get("storyId"),
  });
  if (!parsed.success) {
    return { success: false, error: "Invalid story id" };
  }

  try {
    const { storyId } = parsed.data;

    const scenes = await db
      .select({
        id: schema.storyScenes.id,
        sceneNumber: schema.storyScenes.sceneNumber,
        spreadText: schema.storyScenes.spreadText,
      })
      .from(schema.storyScenes)
      .where(eq(schema.storyScenes.storyId, storyId))
      .orderBy(asc(schema.storyScenes.sceneNumber));

    if (scenes.length === 0) {
      return { success: false, error: "No scenes found. Generate story scenes first." };
    }

    const finalPages = await db
      .select({
        id: schema.finalPages.id,
        sceneId: schema.finalPages.sceneId,
        imageUrl: schema.finalPages.imageUrl,
        isApproved: schema.finalPages.isApproved,
        version: schema.finalPages.version,
        createdAt: schema.finalPages.createdAt,
      })
      .from(schema.finalPages)
      .where(inArray(schema.finalPages.sceneId, scenes.map((scene) => scene.id)));

    const pagesBySceneId = finalPages.reduce<
      Map<
        string,
        Array<{
          id: string;
          imageUrl: string;
          isApproved: boolean | null;
          version: number | null;
          createdAt: Date | string | number | null;
        }>
      >
    >((acc, page) => {
      const current = acc.get(page.sceneId) ?? [];
      current.push(page);
      acc.set(page.sceneId, current);
      return acc;
    }, new Map());

    const spreads = scenes.map((scene) => {
      const candidates = pagesBySceneId.get(scene.id) ?? [];
      const approved = candidates
        .filter((page) => Boolean(page.isApproved))
        .sort((a, b) => {
          const timeDiff = toSortTimestamp(b.createdAt) - toSortTimestamp(a.createdAt);
          if (timeDiff !== 0) return timeDiff;
          return (b.version ?? 0) - (a.version ?? 0);
        });
      const latest = candidates
        .slice()
        .sort((a, b) => {
          const timeDiff = toSortTimestamp(b.createdAt) - toSortTimestamp(a.createdAt);
          if (timeDiff !== 0) return timeDiff;
          return (b.version ?? 0) - (a.version ?? 0);
        })[0];
      const chosenPage = approved[0] ?? latest;
      return {
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        spreadText: scene.spreadText,
        imageUrl: chosenPage?.imageUrl ?? null,
      };
    });

    const missingSceneNumbers = spreads
      .filter((spread) => !spread.imageUrl)
      .map((spread) => spread.sceneNumber);

    if (missingSceneNumbers.length > 0) {
      return {
        success: false,
        error: `Missing final pages for scene(s): ${missingSceneNumbers.join(", ")}. Generate final pages first.`,
      };
    }

    const storyRows = await db
      .select({ id: schema.stories.id, title: schema.stories.title })
      .from(schema.stories)
      .where(eq(schema.stories.id, storyId))
      .limit(1);
    const story = storyRows[0];
    if (!story) {
      return { success: false, error: "Story not found" };
    }

    const { book } = await getOrCreateInternalBookForStory(storyId);

    const interiorBuffer = await generateBookInteriorPdfBuffer({
      storyId,
      title: story.title ?? "Untitled story",
      spreads: spreads.map((spread) => ({
        sceneId: spread.sceneId,
        sceneNumber: spread.sceneNumber,
        spreadText: spread.spreadText,
        imageUrl: spread.imageUrl!,
      })),
    });
    const coverImageCandidates = await db
      .select({
        type: schema.generatedAssets.type,
        storageUrl: schema.generatedAssets.storageUrl,
        createdAt: schema.generatedAssets.createdAt,
      })
      .from(schema.generatedAssets)
      .where(
        and(
          eq(schema.generatedAssets.entityId, storyId),
          inArray(schema.generatedAssets.type, ["final_cover_image", "story_cover"])
        )
      )
      .orderBy(desc(schema.generatedAssets.createdAt));
    const finalCoverImageUrl =
      coverImageCandidates.find((asset) => asset.type === "final_cover_image")?.storageUrl ??
      null;
    const storyboardCoverImageUrl =
      coverImageCandidates.find((asset) => asset.type === "story_cover")?.storageUrl ?? null;
    const coverBuffer = await generateBookCoverPdfBuffer({
      storyId,
      title: story.title ?? "Untitled story",
      spreads: spreads.map((spread) => ({
        sceneId: spread.sceneId,
        sceneNumber: spread.sceneNumber,
        spreadText: spread.spreadText,
        imageUrl: spread.imageUrl!,
      })),
      heroImageUrl: finalCoverImageUrl ?? storyboardCoverImageUrl,
    });

    const timestamp = Date.now();
    const interiorKey = `books/${storyId}/interior-${timestamp}.pdf`;
    const coverKey = `books/${storyId}/cover-${timestamp}.pdf`;
    const interiorUrl = await uploadToR2(interiorBuffer, interiorKey, "application/pdf");
    const coverUrl = await uploadToR2(coverBuffer, coverKey, "application/pdf");

    await db.insert(schema.generatedAssets).values([
      {
        id: newId(),
        type: BOOK_INTERIOR_ASSET_TYPE,
        entityId: book.id,
        storageUrl: interiorUrl,
        mimeType: "application/pdf",
        fileSizeBytes: interiorBuffer.length,
        metadata: JSON.stringify({ storyId }),
      },
      {
        id: newId(),
        type: BOOK_COVER_ASSET_TYPE,
        entityId: book.id,
        storageUrl: coverUrl,
        mimeType: "application/pdf",
        fileSizeBytes: coverBuffer.length,
        metadata: JSON.stringify({ storyId }),
      },
    ]);

    await db
      .update(schema.books)
      .set({
        pdfUrl: interiorUrl,
        printStatus: "pdf_ready",
        updatedAt: new Date(),
      })
      .where(eq(schema.books.id, book.id));

    revalidatePath("/admin/books");
    revalidatePath(`/admin/books/${storyId}`);
    revalidatePath(`/admin/stories/${storyId}`);

    return { success: true, data: { bookId: book.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate PDF",
    };
  }
}

async function getLatestLuluPdfAssetUrls(bookId: string): Promise<{
  interiorUrl: string | null;
  coverUrl: string | null;
}> {
  const assets = await db
    .select({
      type: schema.generatedAssets.type,
      storageUrl: schema.generatedAssets.storageUrl,
      createdAt: schema.generatedAssets.createdAt,
    })
    .from(schema.generatedAssets)
    .where(
      and(
        eq(schema.generatedAssets.entityId, bookId),
        inArray(schema.generatedAssets.type, [BOOK_INTERIOR_ASSET_TYPE, BOOK_COVER_ASSET_TYPE])
      )
    )
    .orderBy(desc(schema.generatedAssets.createdAt));

  let interiorUrl: string | null = null;
  let coverUrl: string | null = null;
  for (const asset of assets) {
    if (asset.type === BOOK_INTERIOR_ASSET_TYPE && !interiorUrl) {
      interiorUrl = asset.storageUrl;
    }
    if (asset.type === BOOK_COVER_ASSET_TYPE && !coverUrl) {
      coverUrl = asset.storageUrl;
    }
    if (interiorUrl && coverUrl) break;
  }

  return { interiorUrl, coverUrl };
}

async function recordLuluArtifact(input: {
  entityType: string;
  entityId: string;
  status: "running" | "success" | "failed";
  rawPrompt: string;
  parameters?: unknown;
  resultUrl?: string | null;
  errorMessage?: string | null;
}) {
  await db.insert(schema.promptArtifacts).values({
    id: newId(),
    entityType: input.entityType,
    entityId: input.entityId,
    rawPrompt: input.rawPrompt,
    model: "lulu-api",
    status: input.status,
    parameters: input.parameters ?? null,
    resultUrl: input.resultUrl ?? null,
    errorMessage: input.errorMessage ?? null,
    createdAt: new Date(),
  });
}

export async function getLuluPreflightIssues(bookId: string): Promise<{
  blockers: string[];
  warnings: string[];
}> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const configErrors = getLuluConfigValidationErrors();
  blockers.push(...configErrors);

  const assetUrls = await getLatestLuluPdfAssetUrls(bookId);
  if (!assetUrls.interiorUrl) blockers.push("Missing interior print PDF. Generate print export first.");
  if (!assetUrls.coverUrl) blockers.push("Missing cover print PDF. Generate print export first.");

  if (!process.env.OUTLINE_IMAGE_URL && !process.env.NEXT_PUBLIC_APP_URL) {
    warnings.push(
      "Outline reference URL is missing; cover generation quality may be inconsistent (set OUTLINE_IMAGE_URL)."
    );
  }

  return { blockers, warnings };
}

export async function updateManualPrintAction(formData: FormData): Promise<ActionResult> {
  const parsed = updateManualPrintSchema.safeParse({
    bookId: formData.get("bookId"),
    luluPrintJobId: formData.get("luluPrintJobId") ?? undefined,
    printStatus: formData.get("printStatus") ?? undefined,
    trackingUrl: formData.get("trackingUrl") ?? undefined,
  });

  if (!parsed.success) {
    return { success: false, error: "Invalid print update payload" };
  }

  try {
    const { bookId } = parsed.data;
    const luluPrintJobId = parsed.data.luluPrintJobId?.trim() || null;
    const trackingUrl = parsed.data.trackingUrl?.trim() || null;
    const status: ManualPrintStatus = normalizeManualPrintStatus(parsed.data.printStatus);
    const currentBookRows = await db
      .select({
        orderId: schema.books.orderId,
        printStatus: schema.books.printStatus,
      })
      .from(schema.books)
      .where(eq(schema.books.id, bookId))
      .limit(1);
    const currentBook = currentBookRows[0];

    await db
      .update(schema.books)
      .set({
        luluPrintJobId,
        printStatus: status,
        trackingUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.books.id, bookId));
    if (currentBook?.orderId) {
      await sendPrintStatusMilestoneIfNeeded({
        orderId: currentBook.orderId,
        previousStatus: currentBook.printStatus,
        nextStatus: status,
        trackingUrl,
      });
    }

    const storyRows = await db
      .select({ storyId: schema.orders.storyId })
      .from(schema.books)
      .innerJoin(schema.orders, eq(schema.books.orderId, schema.orders.id))
      .where(eq(schema.books.id, bookId))
      .limit(1);
    const storyId = storyRows[0]?.storyId;

    revalidatePath("/admin/books");
    if (storyId) revalidatePath(`/admin/books/${storyId}`);

    return { success: true, data: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update print status",
    };
  }
}

export async function createOrGetBookForStoryAction(
  formData: FormData
): Promise<ActionResult<{ storyId: string; bookId: string }>> {
  const parsed = generatePdfSchema.safeParse({ storyId: formData.get("storyId") });
  if (!parsed.success) {
    return { success: false, error: "Invalid story id" };
  }

  try {
    const { storyId } = parsed.data;
    const { book } = await getOrCreateInternalBookForStory(storyId);
    revalidatePath("/admin/books");
    revalidatePath(`/admin/books/${storyId}`);
    return { success: true, data: { storyId, bookId: book.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to initialize book record",
    };
  }
}

export async function submitToLuluAction(formData: FormData): Promise<ActionResult<{ printJobId: string }>> {
  const parsed = bookIdSchema.safeParse({ bookId: formData.get("bookId") });
  if (!parsed.success) {
    return { success: false, error: "Invalid book id" };
  }

  try {
    const bookRows = await db
      .select({
        id: schema.books.id,
        pdfUrl: schema.books.pdfUrl,
        orderId: schema.books.orderId,
        printStatus: schema.books.printStatus,
        trackingUrl: schema.books.trackingUrl,
      })
      .from(schema.books)
      .where(eq(schema.books.id, parsed.data.bookId))
      .limit(1);
    const book = bookRows[0];
    if (!book) return { success: false, error: "Book not found" };
    if (!book.pdfUrl) return { success: false, error: "Generate a PDF first before sending to Lulu" };
    if (!book.orderId) return { success: false, error: "Book has no order linkage" };
    const { interiorUrl, coverUrl } = await getLatestLuluPdfAssetUrls(book.id);
    if (!interiorUrl || !coverUrl) {
      return {
        success: false,
        error: "Generate Lulu-ready interior + cover PDFs first.",
      };
    }

    const preflight = await getLuluPreflightIssues(book.id);
    if (preflight.blockers.length > 0) {
      return {
        success: false,
        error: `Preflight failed: ${preflight.blockers.join(" | ")}`,
      };
    }

    const orderStoryRows = await db
      .select({
        storyId: schema.orders.storyId,
        storyTitle: schema.stories.title,
      })
      .from(schema.orders)
      .innerJoin(schema.stories, eq(schema.orders.storyId, schema.stories.id))
      .where(eq(schema.orders.id, book.orderId))
      .limit(1);

    const orderStory = orderStoryRows[0];
    if (!orderStory?.storyId) {
      return { success: false, error: "Story not found for this book" };
    }

    await recordLuluArtifact({
      entityType: LULU_SUBMIT_ENTITY_TYPE,
      entityId: book.id,
      status: "running",
      rawPrompt: "Submit print job to Lulu",
      parameters: {
        storyId: orderStory.storyId,
        title: orderStory.storyTitle?.trim() || "Internal QA proof",
        interiorUrl,
        coverUrl,
      },
    });

    const luluJob = await createLuluPrintJob({
      externalId: `book-${book.id}-${Date.now()}`,
      title: orderStory.storyTitle?.trim() || "Internal QA proof",
      interiorPdfUrl: interiorUrl,
      coverPdfUrl: coverUrl,
    });

    await db
      .update(schema.books)
      .set({
        luluPrintJobId: luluJob.id,
        printStatus: mapLuluStatusToInternal(luluJob.status),
        trackingUrl: luluJob.trackingUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.books.id, book.id));
    if (book.orderId) {
      await sendPrintStatusMilestoneIfNeeded({
        orderId: book.orderId,
        previousStatus: book.printStatus,
        nextStatus: mapLuluStatusToInternal(luluJob.status),
        trackingUrl: luluJob.trackingUrl,
      });
    }

    revalidatePath("/admin/books");
    revalidatePath(`/admin/books/${orderStory.storyId}`);

    await recordLuluArtifact({
      entityType: LULU_SUBMIT_ENTITY_TYPE,
      entityId: book.id,
      status: "success",
      rawPrompt: "Submit print job to Lulu",
      parameters: { printJobId: luluJob.id, status: luluJob.status },
      resultUrl: luluJob.trackingUrl,
    });

    return { success: true, data: { printJobId: luluJob.id } };
  } catch (error) {
    const bookId = String(formData.get("bookId") ?? "");
    if (bookId) {
      await recordLuluArtifact({
        entityType: LULU_SUBMIT_ENTITY_TYPE,
        entityId: bookId,
        status: "failed",
        rawPrompt: "Submit print job to Lulu",
        errorMessage: error instanceof Error ? error.message : "Failed to submit to Lulu",
      });
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit to Lulu",
    };
  }
}

export async function refreshLuluStatusAction(formData: FormData): Promise<ActionResult<{ status: string | null }>> {
  const parsed = bookIdSchema.safeParse({ bookId: formData.get("bookId") });
  if (!parsed.success) {
    return { success: false, error: "Invalid book id" };
  }

  try {
    const bookRows = await db
      .select({
        id: schema.books.id,
        luluPrintJobId: schema.books.luluPrintJobId,
        orderId: schema.books.orderId,
        printStatus: schema.books.printStatus,
        trackingUrl: schema.books.trackingUrl,
      })
      .from(schema.books)
      .where(eq(schema.books.id, parsed.data.bookId))
      .limit(1);
    const book = bookRows[0];
    if (!book) return { success: false, error: "Book not found" };
    if (!book.luluPrintJobId) return { success: false, error: "No Lulu print job id found on this book" };

    await recordLuluArtifact({
      entityType: LULU_REFRESH_ENTITY_TYPE,
      entityId: book.id,
      status: "running",
      rawPrompt: "Refresh Lulu print job status",
      parameters: { printJobId: book.luluPrintJobId },
    });

    const luluJob = await getLuluPrintJob(book.luluPrintJobId);
    const mappedStatus = mapLuluStatusToInternal(luluJob.status);

    await db
      .update(schema.books)
      .set({
        printStatus: mappedStatus,
        trackingUrl: luluJob.trackingUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.books.id, book.id));
    if (book.orderId) {
      await sendPrintStatusMilestoneIfNeeded({
        orderId: book.orderId,
        previousStatus: book.printStatus,
        nextStatus: mappedStatus,
        trackingUrl: luluJob.trackingUrl,
      });
    }

    const storyRows = book.orderId
      ? await db
          .select({ storyId: schema.orders.storyId })
          .from(schema.orders)
          .where(eq(schema.orders.id, book.orderId))
          .limit(1)
      : [];
    const storyId = storyRows[0]?.storyId;

    revalidatePath("/admin/books");
    if (storyId) revalidatePath(`/admin/books/${storyId}`);

    await recordLuluArtifact({
      entityType: LULU_REFRESH_ENTITY_TYPE,
      entityId: book.id,
      status: "success",
      rawPrompt: "Refresh Lulu print job status",
      parameters: { printJobId: book.luluPrintJobId, status: luluJob.status },
      resultUrl: luluJob.trackingUrl,
    });

    return { success: true, data: { status: luluJob.status } };
  } catch (error) {
    const bookId = String(formData.get("bookId") ?? "");
    if (bookId) {
      await recordLuluArtifact({
        entityType: LULU_REFRESH_ENTITY_TYPE,
        entityId: bookId,
        status: "failed",
        rawPrompt: "Refresh Lulu print job status",
        errorMessage: error instanceof Error ? error.message : "Failed to refresh Lulu status",
      });
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to refresh Lulu status",
    };
  }
}

export async function retryPaidOrderProcessingAction(
  formData: FormData
): Promise<ActionResult<{ orderId: string }>> {
  const parsed = bookIdSchema.safeParse({ bookId: formData.get("bookId") });
  if (!parsed.success) {
    return { success: false, error: "Invalid book id" };
  }

  try {
    const rows = await db
      .select({
        orderId: schema.books.orderId,
      })
      .from(schema.books)
      .where(eq(schema.books.id, parsed.data.bookId))
      .limit(1);
    const orderId = rows[0]?.orderId;
    if (!orderId) {
      return { success: false, error: "Book has no linked order" };
    }

    await inngest.send({
      name: "order/paid",
      data: { orderId },
    });

    await db.insert(schema.promptArtifacts).values({
      id: newId(),
      entityType: "order_generation_pipeline_retry",
      entityId: orderId,
      rawPrompt: "Manual retry requested from admin fulfillment page",
      model: "internal-pipeline",
      status: "success",
      createdAt: new Date(),
    });

    const storyRows = await db
      .select({ storyId: schema.orders.storyId })
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .limit(1);
    const storyId = storyRows[0]?.storyId;

    revalidatePath("/admin/books");
    if (storyId) revalidatePath(`/admin/books/${storyId}`);

    return { success: true, data: { orderId } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to enqueue processing retry",
    };
  }
}
