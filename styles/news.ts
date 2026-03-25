import { StyleSheet } from "react-native";

export const palette = {
  bg: "#f7f2e8",
  card: "#fffdf8",
  ink: "#151515",
  muted: "#6d665d",
  accent: "#0f766e",
  accentSoft: "#d5efe9",
  border: "#e5dbc9"
};

export const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: palette.bg
  },
  screen: {
    flex: 1,
    backgroundColor: palette.bg
  },
  feedContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14
  },
  masthead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    paddingBottom: 2,
    minHeight: 42
  },
  mastheadSide: {
    width: 104
  },
  mastheadBrand: {
    color: palette.ink,
    flex: 1,
    textAlign: "center",
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: 0.3
  },
  mastheadAccountButton: {
    minWidth: 104,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  mastheadAccountLabel: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "800"
  },
  accountScreen: {
    paddingHorizontal: 16,
    paddingTop: 16
  },
  accountCard: {
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    gap: 14
  },
  accountTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "800"
  },
  accountField: {
    gap: 4
  },
  accountFieldLabel: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  accountFieldValue: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 21
  },
  accountSignOutButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: "#8a1f11",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  accountSignOutButtonPressed: {
    opacity: 0.9
  },
  accountSignOutLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800"
  },
  heroCard: {
    backgroundColor: "#13322c",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20
  },
  heroEyebrow: {
    color: "#b8f0e4",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 4
  },
  heroSubtitle: {
    color: "#d7e6e2",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6
  },
  devUserSection: {
    gap: 6
  },
  devUserTitle: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "700"
  },
  categoryRow: {
    gap: 8,
    paddingVertical: 4
  },
  sectionBlock: {
    gap: 8
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 2
  },
  sectionArticles: {
    gap: 12
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  categoryChipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft
  },
  categoryChipText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "700"
  },
  categoryChipTextActive: {
    color: palette.accent
  },
  articleCard: {
    backgroundColor: palette.card,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10
  },
  articleCardPressed: {
    opacity: 0.92
  },
  articleCardFeatured: {
    borderColor: "#bedfd8"
  },
  articleImage: {
    width: "100%",
    height: 160,
    backgroundColor: "#ddd"
  },
  articleCardBody: {
    padding: 14,
    gap: 8
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  topicBadge: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: palette.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden"
  },
  metaText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "600"
  },
  articleTitle: {
    color: palette.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800"
  },
  articleLead: {
    color: "#2f2a24",
    fontSize: 15,
    lineHeight: 22
  },
  articleLeadBlock: {
    backgroundColor: "#f6f3ed",
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 4
  },
  articleLeadLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  articleCategory: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  articleVariantTag: {
    alignSelf: "flex-start",
    color: "#0e4f49",
    backgroundColor: "#dff3ef",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  readerContent: {
    paddingBottom: 28
  },
  readerHeroImage: {
    width: "100%",
    height: 240,
    backgroundColor: "#ddd"
  },
  readerHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10
  },
  readerTitle: {
    color: palette.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800"
  },
  readerLead: {
    color: "#403a34",
    fontSize: 16,
    lineHeight: 23
  },
  readerCategory: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  activeVariantTag: {
    alignSelf: "flex-start",
    color: "#0e4f49",
    backgroundColor: "#dff3ef",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  sourceLinkButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#bfe0da",
    backgroundColor: "#eefaf7",
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  sourceLinkButtonPressed: {
    opacity: 0.9
  },
  sourceLinkButtonText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: "800"
  },
  readerBody: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 14
  },
  readerParagraph: {
    color: palette.ink,
    fontSize: 17,
    lineHeight: 27
  },
  tailorButton: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#bfe0da",
    backgroundColor: "#eefaf7",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  tailorButtonContent: {
    flex: 1,
    minWidth: 0
  },
  tailorButtonPressed: {
    opacity: 0.92
  },
  tailorButtonLabel: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800"
  },
  tailorButtonSubtext: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 2
  },
  tailorButtonChevron: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: "800",
    flexShrink: 0
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end"
  },
  sheetScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(16, 16, 16, 0.35)"
  },
  sheet: {
    backgroundColor: "#fffdf8",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 26,
    gap: 14,
    borderTopWidth: 1,
    borderColor: palette.border
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#d9d2c6"
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  sheetTitle: {
    color: palette.ink,
    fontSize: 19,
    fontWeight: "800"
  },
  sheetSubtitle: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    maxWidth: 250
  },
  sheetDoneButton: {
    borderRadius: 999,
    backgroundColor: palette.accent,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  sheetDoneButtonPressed: {
    opacity: 0.9
  },
  sheetDoneButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800"
  },
  tailorSection: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    backgroundColor: "#fff",
    padding: 12,
    gap: 10
  },
  tailorLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  tailorLabel: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "700"
  },
  tailorValuePill: {
    color: palette.accent,
    backgroundColor: palette.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "700"
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16
  },
  sliderTrack: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  sliderStep: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd5c7",
    backgroundColor: "#faf7f1",
    alignItems: "center",
    justifyContent: "center"
  },
  sliderStepActive: {
    borderColor: "#8fd1c6",
    backgroundColor: "#e5f6f2"
  },
  sliderDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#bfb7aa"
  },
  sliderDotActive: {
    width: 12,
    height: 12,
    backgroundColor: palette.accent
  },
  sliderLabelsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  sliderHint: {
    flex: 1,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17
  },
  previewNotice: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2d7c3",
    backgroundColor: "#fbf6ea",
    padding: 12,
    gap: 4
  },
  previewNoticeTitle: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "800"
  },
  previewNoticeText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18
  },
  previewNoticeEmphasis: {
    color: palette.ink,
    fontWeight: "800"
  },
  loadingCard: {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border
  },
  loadingText: {
    color: palette.muted,
    fontSize: 14
  },
  errorText: {
    color: "#8a1f11",
    fontSize: 14,
    lineHeight: 20
  }
});
