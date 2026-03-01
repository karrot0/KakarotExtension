import { ContentRating, ExtensionInfo, SourceIntents } from "@paperback/types";

export default {
  name: "GodaComic",
  description: "Extension that pulls content from https://manhuascans.org/",
  version: "1.0.0-alpha.1",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.EVERYONE,
  badges: [
    { label: "Aggregator", textColor: "#FFFFFF", backgroundColor: "#800080" },
  ],
  capabilities: [
    SourceIntents.DISCOVER_SECIONS_PROVIDING,
    SourceIntents.SEARCH_RESULTS_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
  ],
  developers: [
    {
      name: "Karrot",
    },
  ],
} satisfies ExtensionInfo;
