import { ContentRating, ExtensionInfo, SourceIntents } from "@paperback/types";

export default {
  name: "ZipComic",
  description: "Extension that pulls content from zipcomic.com.",
  version: "1.0",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.EVERYONE,
  badges: [
    { label: "Aggregator", textColor: "#FFFFFF", backgroundColor: "#800080" },
    {
      label: "Western Comics",
      textColor: "#FFFFFF",
      backgroundColor: "#3E4A59",
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
