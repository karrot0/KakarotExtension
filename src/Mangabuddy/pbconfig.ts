import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Mangabuddy",
  description: "Extension that pulls content from mangabuddy.com.",
  version: "1.0.0-alpha.4",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.MATURE,
  badges: [
    { label: "Aggregator", textColor: "#FFFFFF", backgroundColor: "#800080" },
    { label: "Mature", textColor: "#FFFFFF", backgroundColor: "#800080" },
    { label: "Manga", textColor: "#FFFFFF", backgroundColor: "#C71585" },
    { label: "Manhwa", textColor: "#FFFFFF", backgroundColor: "#C71585" },
    { label: "Manhua", textColor: "#FFFFFF", backgroundColor: "#C71585" },
  ],
  capabilities: [
    SourceIntents.DISCOVER_SECIONS,
    SourceIntents.MANGA_SEARCH,
    SourceIntents.MANGA_CHAPTERS,
    SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
  ],
  developers: [
    {
      name: "Karrot",
    },
    {
      name: "Havilah",
    },
  ],
} satisfies SourceInfo;
