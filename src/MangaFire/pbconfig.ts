import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
  name: "MangaFire",
  description: "A paperback extension for MangaFire",
  version: "0.9.0",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.EVERYONE,
  badges: [
    { label: "ALL MANGA", textColor: "#FFFFFF", backgroundColor: "#FF1493" }, // Hot pink
    { label: "BEST QUALITY", textColor: "#FFFFFF", backgroundColor: "#008B8B" }, // Dark cyan
    { label: "AGGREGATOR", textColor: "#FFFFFF", backgroundColor: "#9400D3" }, // Dark violet
  ],
  capabilities: [
    SourceIntents.SETTINGS_UI,
    SourceIntents.COLLECTION_MANAGEMENT,
    SourceIntents.DISCOVER_SECIONS,
    SourceIntents.MANGA_SEARCH,
    SourceIntents.MANGA_CHAPTERS,
  ],
  developers: [
    {
      name: "Karrot",
    },
    {
      name: "nyzzik",
    },
  ],
} satisfies SourceInfo;
