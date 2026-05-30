import { ContentRating, ExtensionInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Mangak",
  description: "Extension that pulls content from mangak.io.",
  version: "1.0.0",
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
    SourceIntents.DISCOVER_SECTION_PROVIDING,
    SourceIntents.SEARCH_RESULT_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
    SourceIntents.CLOUDFLARE_BYPASS_PROVIDING,
  ],
  developers: [
    {
      name: "Karrot",
    },
    {
      name: "Havilah",
    },
  ],
} satisfies ExtensionInfo;
