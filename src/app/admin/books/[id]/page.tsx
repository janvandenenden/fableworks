import { and, asc, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import {
  MANUAL_PRINT_STATUSES,
  getLuluConfigValidationErrors,
  toManualPrintStatusLabel,
} from "@/lib/lulu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createOrGetBookForStoryAction,
  generateBookPdfAction,
  refreshLuluStatusAction,
  retryPaidOrderProcessingAction,
  submitToLuluAction,
  updateManualPrintAction,
} from "@/app/admin/books/actions";

export default async function AdminBookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: storyId } = await params;

  const storyRows = await db
    .select({
      id: schema.stories.id,
      title: schema.stories.title,
      status: schema.stories.status,
      updatedAt: schema.stories.updatedAt,
    })
    .from(schema.stories)
    .where(eq(schema.stories.id, storyId))
    .limit(1);
  const story = storyRows[0];
  if (!story) notFound();

  const scenes = await db
    .select({ id: schema.storyScenes.id, sceneNumber: schema.storyScenes.sceneNumber })
    .from(schema.storyScenes)
    .where(eq(schema.storyScenes.storyId, story.id))
    .orderBy(asc(schema.storyScenes.sceneNumber));

  const sceneIds = scenes.map((scene) => scene.id);
  const finalPageRows =
    sceneIds.length > 0
      ? await db
          .select({ sceneId: schema.finalPages.sceneId })
          .from(schema.finalPages)
          .where(inArray(schema.finalPages.sceneId, sceneIds))
      : [];
  const coveredSceneIds = new Set(finalPageRows.map((row) => row.sceneId));

  const orderRows = await db
    .select({ id: schema.orders.id, paymentStatus: schema.orders.paymentStatus })
    .from(schema.orders)
    .where(eq(schema.orders.storyId, story.id))
    .orderBy(desc(schema.orders.createdAt))
    .limit(1);
  const order = orderRows[0] ?? null;

  const bookRows = order
    ? await db
        .select({
          id: schema.books.id,
          pdfUrl: schema.books.pdfUrl,
          printStatus: schema.books.printStatus,
          luluPrintJobId: schema.books.luluPrintJobId,
          trackingUrl: schema.books.trackingUrl,
          updatedAt: schema.books.updatedAt,
        })
        .from(schema.books)
        .where(eq(schema.books.orderId, order.id))
        .orderBy(desc(schema.books.createdAt))
        .limit(1)
    : [];
  const book = bookRows[0] ?? null;
  const latestPdfAssets = book
    ? await db
        .select({
          type: schema.generatedAssets.type,
          storageUrl: schema.generatedAssets.storageUrl,
          createdAt: schema.generatedAssets.createdAt,
        })
        .from(schema.generatedAssets)
        .where(
          and(
            eq(schema.generatedAssets.entityId, book.id),
            inArray(schema.generatedAssets.type, ["book_pdf_interior", "book_pdf_cover"])
          )
        )
        .orderBy(desc(schema.generatedAssets.createdAt))
    : [];
  const interiorPdfUrl =
    latestPdfAssets.find((asset) => asset.type === "book_pdf_interior")?.storageUrl ?? null;
  const coverPdfUrl =
    latestPdfAssets.find((asset) => asset.type === "book_pdf_cover")?.storageUrl ?? null;

  const title = story.title?.trim() || "Untitled story";
  const canGeneratePdf = scenes.length > 0 && coveredSceneIds.size === scenes.length;
  const hasLuluReadyFiles = Boolean(interiorPdfUrl && coverPdfUrl);
  const luluConfigErrors = getLuluConfigValidationErrors();
  const preflightBlockers = [
    ...luluConfigErrors,
    ...(interiorPdfUrl ? [] : ["Missing interior print PDF. Generate print export first."]),
    ...(coverPdfUrl ? [] : ["Missing cover print PDF. Generate print export first."]),
  ];
  const preflightWarnings = [
    ...(!story.title?.trim() ? ["Story title is empty; Lulu listing title will be generic."] : []),
    ...(process.env.OUTLINE_IMAGE_URL || process.env.NEXT_PUBLIC_APP_URL
      ? []
      : [
          "No OUTLINE_IMAGE_URL is configured; composition guidance for covers can be less stable.",
        ]),
  ];
  const luluRunHistory = book
    ? await db
        .select({
          id: schema.promptArtifacts.id,
          entityType: schema.promptArtifacts.entityType,
          status: schema.promptArtifacts.status,
          errorMessage: schema.promptArtifacts.errorMessage,
          parameters: schema.promptArtifacts.parameters,
          createdAt: schema.promptArtifacts.createdAt,
        })
        .from(schema.promptArtifacts)
        .where(
          and(
            eq(schema.promptArtifacts.entityId, book.id),
            inArray(schema.promptArtifacts.entityType, [
              "lulu_print_submit",
              "lulu_print_status_refresh",
            ])
          )
        )
        .orderBy(desc(schema.promptArtifacts.createdAt))
        .limit(10)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">Internal fulfillment for story {story.id}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/books">Back to Fulfillment</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PDF Generation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Scenes with at least one final page: {coveredSceneIds.size}/{scenes.length}
          </p>

          <div className="flex flex-wrap gap-2">
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

            {interiorPdfUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={interiorPdfUrl} target="_blank" rel="noreferrer">
                  Download Interior PDF
                </a>
              </Button>
            ) : null}
            {coverPdfUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={coverPdfUrl} target="_blank" rel="noreferrer">
                  Download Cover PDF
                </a>
              </Button>
            ) : null}
          </div>

          {!canGeneratePdf ? (
            <p className="text-amber-600">
              Generate final pages for every scene before creating the PDF.
            </p>
          ) : null}
          {!hasLuluReadyFiles && book ? (
            <p className="text-amber-600">
              Generate PDF to create both interior and cover files before Lulu submission.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lulu Submission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!book ? (
            <p className="text-muted-foreground">
              Initialize a book record first. Then you can store manual Lulu job metadata.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground">
                Current status: {toManualPrintStatusLabel(book.printStatus)}
                {book.luluPrintJobId ? ` · Job ID: ${book.luluPrintJobId}` : ""}
              </p>

              <div className="flex flex-wrap gap-2">
                <form action={submitToLuluAction}>
                  <input type="hidden" name="bookId" value={book.id} />
                  <Button type="submit" size="sm" disabled={preflightBlockers.length > 0}>
                    Send to Lulu
                  </Button>
                </form>
                <form action={refreshLuluStatusAction}>
                  <input type="hidden" name="bookId" value={book.id} />
                  <Button type="submit" variant="outline" size="sm" disabled={!book.luluPrintJobId}>
                    Refresh Print Status
                  </Button>
                </form>
                <form action={retryPaidOrderProcessingAction}>
                  <input type="hidden" name="bookId" value={book.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Retry Processing
                  </Button>
                </form>
              </div>

              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <p className="font-medium">Preflight Checklist</p>
                {preflightBlockers.length === 0 ? (
                  <p className="text-emerald-700">No blockers. Ready to submit.</p>
                ) : (
                  <ul className="list-disc space-y-1 pl-5 text-amber-700">
                    {preflightBlockers.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                )}
                {preflightWarnings.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    {preflightWarnings.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <form action={updateManualPrintAction} className="grid gap-3 md:grid-cols-2">
                <input type="hidden" name="bookId" value={book.id} />

                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="luluPrintJobId">Lulu print job ID</Label>
                  <Input
                    id="luluPrintJobId"
                    name="luluPrintJobId"
                    defaultValue={book.luluPrintJobId ?? ""}
                    placeholder="e.g. lulu-job-123"
                  />
                </div>

                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="trackingUrl">Tracking URL</Label>
                  <Input
                    id="trackingUrl"
                    name="trackingUrl"
                    defaultValue={book.trackingUrl ?? ""}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="printStatus">Print status</Label>
                  <select
                    id="printStatus"
                    name="printStatus"
                    defaultValue={book.printStatus ?? "draft"}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  >
                    {MANUAL_PRINT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Button type="submit" size="sm">
                    Save Manual Overrides
                  </Button>
                </div>
              </form>

              <div className="space-y-2">
                <p className="font-medium">Lulu Attempt History</p>
                {luluRunHistory.length === 0 ? (
                  <p className="text-muted-foreground">
                    No submit/refresh attempts recorded yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {luluRunHistory.map((run) => (
                      <div key={run.id} className="rounded-md border p-2">
                        <p className="text-xs text-muted-foreground">
                          {run.entityType === "lulu_print_submit" ? "submit" : "refresh"} ·{" "}
                          {run.status ?? "unknown"} ·{" "}
                          {run.createdAt ? new Date(run.createdAt).toLocaleString() : "unknown time"}
                        </p>
                        {run.errorMessage ? (
                          <p className="text-xs text-destructive">{run.errorMessage}</p>
                        ) : null}
                        {run.parameters ? (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs text-muted-foreground">
                              details
                            </summary>
                            <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-[11px]">
                              {typeof run.parameters === "string"
                                ? run.parameters
                                : JSON.stringify(run.parameters, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/stories/${story.id}`}>Story Detail</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/stories/${story.id}/pages`}>Final Pages</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/stories/${story.id}/storyboard`}>Storyboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
