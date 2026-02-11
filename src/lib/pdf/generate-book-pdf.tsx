import { renderToBuffer } from "@react-pdf/renderer";
import { BookTemplate, type BookSpread } from "@/lib/pdf/book-template";
import { BookCoverTemplate } from "@/lib/pdf/book-cover-template";

type GenerateBookPdfInput = {
  title: string;
  storyId: string;
  spreads: BookSpread[];
  heroImageUrl?: string | null;
};

export async function generateBookInteriorPdfBuffer(
  input: GenerateBookPdfInput
): Promise<Buffer> {
  const doc = <BookTemplate spreads={input.spreads} />;
  const uint8Array = await renderToBuffer(doc);
  return Buffer.from(uint8Array);
}

export async function generateBookCoverPdfBuffer(
  input: GenerateBookPdfInput
): Promise<Buffer> {
  const heroImageUrl = input.heroImageUrl ?? input.spreads[0]?.imageUrl ?? null;
  const doc = (
    <BookCoverTemplate
      title={input.title}
      storyId={input.storyId}
      heroImageUrl={heroImageUrl}
    />
  );
  const uint8Array = await renderToBuffer(doc);
  return Buffer.from(uint8Array);
}
