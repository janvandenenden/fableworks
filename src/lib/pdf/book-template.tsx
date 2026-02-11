import { Document, Page } from "@react-pdf/renderer";
import { SpreadLayout } from "@/lib/pdf/spread-layout";

type BookSpread = {
  sceneId: string;
  sceneNumber: number;
  spreadText: string | null;
  imageUrl: string;
};

type BookTemplateProps = {
  spreads: BookSpread[];
};

const PAGE_SIZE = { width: 792, height: 612 };

export function BookTemplate({ spreads }: BookTemplateProps) {
  return (
    <Document>
      {spreads.map((spread) => (
        <Page key={spread.sceneId} size={PAGE_SIZE}>
          <SpreadLayout
            sceneNumber={spread.sceneNumber}
            spreadText={spread.spreadText}
            imageUrl={spread.imageUrl}
          />
        </Page>
      ))}
    </Document>
  );
}

export type { BookSpread };
