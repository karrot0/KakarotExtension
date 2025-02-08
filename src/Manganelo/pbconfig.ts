import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Manganelo",
  description: "A paperback extension for Manganelo.com",
  version: "0.9.0",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.EVERYONE,
  badges: [
    { label: "GOOD MANGA", textColor: "#FFFFFF", backgroundColor: "#FF1493" }, // Hot pink
    { label: "AGGREGATOR", textColor: "#FFFFFF", backgroundColor: "#9400D3" }, // Dark violet
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
