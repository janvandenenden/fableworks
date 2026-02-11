import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

type BookCoverTemplateProps = {
  title: string;
  storyId: string;
  heroImageUrl: string | null;
};

const PAGE_SIZE = { width: 792, height: 612 };

const styles = StyleSheet.create({
  page: {
    position: "relative",
    backgroundColor: "#f8fafc",
  },
  heroImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    opacity: 0.4,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(15, 23, 42, 0.28)",
  },
  content: {
    position: "absolute",
    top: 48,
    left: 48,
    right: 48,
    bottom: 48,
    justifyContent: "space-between",
  },
  label: {
    fontSize: 11,
    color: "#e2e8f0",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 44,
    lineHeight: 1.1,
    color: "#ffffff",
    fontWeight: 700,
  },
  meta: {
    fontSize: 10,
    color: "#e2e8f0",
  },
});

export function BookCoverTemplate({ title, storyId, heroImageUrl }: BookCoverTemplateProps) {
  return (
    <Document>
      <Page size={PAGE_SIZE}>
        {heroImageUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={heroImageUrl} style={styles.heroImage} />
        ) : null}
        <View style={styles.overlay} />
        <View style={styles.content}>
          <Text style={styles.label}>Fableworks</Text>
          <Text style={styles.title}>{title.trim() || "Untitled Story"}</Text>
          <Text style={styles.meta}>Internal proof cover · Story {storyId}</Text>
        </View>
      </Page>
    </Document>
  );
}
