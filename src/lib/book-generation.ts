import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  generateBookCoverPdfBuffer,
  generateBookInteriorPdfBuffer,
} from "@/lib/pdf/generate-book-pdf";
import { uploadToR2 } from "@/lib/r2";

const BOOK_INTERIOR_ASSET_TYPE = "book_pdf_interior";
const BOOK_COVER_ASSET_TYPE = "book_pdf_cover";

function newId(): string {
  return crypto.randomUUID();
}

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
      ? `${value.replace(" ", "T")}Z`
      : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toSortTimestamp(value: Date | string | number | null | undefined): number {
  return normalizeDateInput(value)?.getTime() ?? 0;
}

async function getOrCreateBookForStory(storyId: string) {
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

  return { order, book };
}

export async function generatePrintFilesForStory(storyId: string): Promise<{
  orderId: string;
  bookId: string;
  interiorUrl: string;
  coverUrl: string;
}> {
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
    throw new Error("No scenes found. Generate story scenes first.");
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
    throw new Error(
      `Missing final pages for scene(s): ${missingSceneNumbers.join(", ")}. Generate final pages first.`
    );
  }

  const storyRows = await db
    .select({ id: schema.stories.id, title: schema.stories.title })
    .from(schema.stories)
    .where(eq(schema.stories.id, storyId))
    .limit(1);
  const story = storyRows[0];
  if (!story) {
    throw new Error("Story not found");
  }

  const { order, book } = await getOrCreateBookForStory(storyId);

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
    coverImageCandidates.find((asset) => asset.type === "final_cover_image")?.storageUrl ?? null;
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
      metadata: JSON.stringify({ storyId, source: "pipeline" }),
    },
    {
      id: newId(),
      type: BOOK_COVER_ASSET_TYPE,
      entityId: book.id,
      storageUrl: coverUrl,
      mimeType: "application/pdf",
      fileSizeBytes: coverBuffer.length,
      metadata: JSON.stringify({ storyId, source: "pipeline" }),
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

  return {
    orderId: order.id,
    bookId: book.id,
    interiorUrl,
    coverUrl,
  };
}
