import { ContentRating, ExtensionInfo, SourceIntents } from "@paperback/types";

export default {
  name: "ReadComicsOnlineRu",
  description: "Extension that pulls content from readcomicsonline.ru.",
  version: "1.1",
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
    SourceIntents.DISCOVER_SECTION_PROVIDING,
    SourceIntents.SEARCH_RESULT_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
    SourceIntents.CLOUDFLARE_BYPASS_PROVIDING,
  ],
  developers: [
    {
      name: "Karrot",
    },
  ],
} satisfies ExtensionInfo;
