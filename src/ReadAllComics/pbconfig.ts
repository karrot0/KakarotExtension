import { ContentRating, ExtensionInfo, SourceIntents } from "@paperback/types";

export default {
  name: "ReadAllComics",
  description: "Extension that pulls content from https://readallcomics.com",
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
    SourceIntents.DISCOVER_SECIONS_PROVIDING,
    SourceIntents.SEARCH_RESULTS_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
    SourceIntents.CLOUDFLARE_BYPASS_PROVIDING,
  ],
  developers: [
    {
      name: "Karrot",
    },
  ],
} satisfies ExtensionInfo;
