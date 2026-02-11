import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";

type SpreadLayoutProps = {
  sceneNumber: number;
  spreadText: string | null;
  imageUrl: string;
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    backgroundColor: "#ffffff",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  heading: {
    fontSize: 10,
    color: "#6b7280",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  imageFrame: {
    flexGrow: 1,
    borderRadius: 8,
    overflow: "hidden",
    border: "1pt solid #e5e7eb",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  textBlock: {
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    paddingTop: 10,
    paddingRight: 12,
    paddingBottom: 10,
    paddingLeft: 12,
  },
  spreadText: {
    fontSize: 14,
    lineHeight: 1.35,
    color: "#111827",
  },
});

export function SpreadLayout({ sceneNumber, spreadText, imageUrl }: SpreadLayoutProps) {
  return (
    <View style={styles.page}>
      <Text style={styles.heading}>Scene {sceneNumber}</Text>
      <View style={styles.imageFrame}>
        {/* react-pdf Image is not a DOM img element */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={imageUrl} style={styles.image} />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.spreadText}>{spreadText?.trim() || " "}</Text>
      </View>
    </View>
  );
}
