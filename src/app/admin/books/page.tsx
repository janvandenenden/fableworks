import { and, asc, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { toManualPrintStatusLabel } from "@/lib/lulu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createOrGetBookForStoryAction, generateBookPdfAction } from "@/app/admin/books/actions";

export default async function AdminBooksPage() {
  const stories = await db
    .select({
      id: schema.stories.id,
      title: schema.stories.title,
      status: schema.stories.status,
      updatedAt: schema.stories.updatedAt,
    })
    .from(schema.stories)
    .orderBy(desc(schema.stories.updatedAt), asc(schema.stories.createdAt));

  const rows = await Promise.all(
    stories.map(async (story) => {
      const orderRows = await db
        .select({ id: schema.orders.id })
        .from(schema.orders)
        .where(eq(schema.orders.storyId, story.id))
        .orderBy(desc(schema.orders.createdAt))
        .limit(1);
      const orderId = orderRows[0]?.id ?? null;

      const bookRows = orderId
        ? await db
            .select({
              id: schema.books.id,
              pdfUrl: schema.books.pdfUrl,
              printStatus: schema.books.printStatus,
              luluPrintJobId: schema.books.luluPrintJobId,
              updatedAt: schema.books.updatedAt,
            })
            .from(schema.books)
            .where(eq(schema.books.orderId, orderId))
            .orderBy(desc(schema.books.createdAt))
            .limit(1)
        : [];

      const scenes = await db
        .select({ id: schema.storyScenes.id })
        .from(schema.storyScenes)
        .where(eq(schema.storyScenes.storyId, story.id));
      const sceneIds = scenes.map((scene) => scene.id);

      const finalPageSceneRows =
        sceneIds.length > 0
          ? await db
              .select({ sceneId: schema.finalPages.sceneId })
              .from(schema.finalPages)
              .where(inArray(schema.finalPages.sceneId, sceneIds))
          : [];

      const coveredSceneIds = new Set(finalPageSceneRows.map((row) => row.sceneId));

      return {
        story,
        book: bookRows[0] ?? null,
        scenesCount: sceneIds.length,
        scenesWithFinalPageCount: coveredSceneIds.size,
        hasLuluReadyFiles: Boolean(
          bookRows[0]?.id &&
            (
              await db
                .select({ id: schema.generatedAssets.id })
                .from(schema.generatedAssets)
                .where(
                  and(
                    eq(schema.generatedAssets.entityId, bookRows[0].id),
                    inArray(schema.generatedAssets.type, ["book_pdf_interior", "book_pdf_cover"])
                  )
                )
                .limit(2)
            ).length === 2
        ),
      };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Internal Fulfillment</h1>
        <p className="text-sm text-muted-foreground">
          Generate print-proof PDFs and track manual Lulu submission statuses.
        </p>
      </div>

      <div className="grid gap-4">
        {rows.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No stories found yet.
            </CardContent>
          </Card>
        ) : null}

        {rows.map(({ story, book, scenesCount, scenesWithFinalPageCount, hasLuluReadyFiles }) => {
          const title = story.title?.trim() || "Untitled story";
          const printStatus = toManualPrintStatusLabel(book?.printStatus);
          const canGeneratePdf = scenesCount > 0 && scenesWithFinalPageCount === scenesCount;

          return (
            <Card key={story.id}>
              <CardHeader className="space-y-2">
                <CardTitle className="text-xl">{title}</CardTitle>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">story: {story.status}</Badge>
                  <Badge variant="outline">
                    final pages: {scenesWithFinalPageCount}/{scenesCount}
                  </Badge>
                  <Badge variant="outline">print: {printStatus}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {book?.pdfUrl ? "PDF ready" : "PDF not generated"}
                  {book?.pdfUrl ? hasLuluReadyFiles ? " · Lulu files ready" : " · Lulu files missing" : ""}
                  {book?.luluPrintJobId ? ` · Lulu ID: ${book.luluPrintJobId}` : ""}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/books/${story.id}`}>Open Fulfillment</Link>
                  </Button>

                  {!book ? (
                    <form action={createOrGetBookForStoryAction}>
                      <input type="hidden" name="storyId" value={story.id} />
                      <Button type="submit" variant="outline" size="sm">
                        Initialize Book
                      </Button>
                    </form>
                  ) : null}

                  <form action={generateBookPdfAction}>
                    <input type="hidden" name="storyId" value={story.id} />
                    <Button type="submit" size="sm" disabled={!canGeneratePdf}>
                      Generate PDF
                    </Button>
                  </form>

                  {book?.pdfUrl ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={book.pdfUrl} target="_blank" rel="noreferrer">
                        Download Interior PDF
                      </a>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
