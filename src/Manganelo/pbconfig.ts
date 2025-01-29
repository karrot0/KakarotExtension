import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Manganelo",
  description: "A paperback extension for Manganelo.com",
  version: "0.9.0",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.EVERYONE,
  badges: [
    { label: "ALL MANGA", textColor: "#FFFFFF", backgroundColor: "#F64B4B" },
    { label: "AGGREGATOR", textColor: "#FFFFFF", backgroundColor: "#007AFF" },
  ],
  capabilities: [
    SourceIntents.DISCOVER_SECIONS,
    SourceIntents.MANGA_SEARCH,
    SourceIntents.MANGA_CHAPTERS,
  ],
  developers: [
    {
      name: "Karrot",
    },
  ],
} satisfies SourceInfo;
