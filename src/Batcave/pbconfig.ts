import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Batcave",
  description: "Extension that pulls content from batcave.biz.",
  version: "1.0.0-alpha.3",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.EVERYONE,
  badges: [
    { label: "Aggregator", textColor: "#FFFFFF", backgroundColor: "#800080" },
    { label: "Mature", textColor: "#FFFFFF", backgroundColor: "#800080" },
    {
      label: "Western Comics",
      textColor: "#FFFFFF",
      backgroundColor: "#C71585",
    },
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
