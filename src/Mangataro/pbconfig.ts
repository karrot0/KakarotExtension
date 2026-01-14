import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Mangataro",
  description: "Extension that pulls content from mangataro.org.",
  version: "1.0.0-alpha.1",
  icon: "icon.png",
  language: "English",
  contentRating: ContentRating.EVERYONE,
  capabilities: [
    SourceIntents.DISCOVER_SECIONS_PROVIDING,
    SourceIntents.SEARCH_RESULTS_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
  ],
  badges: [],
  developers: [
    {
      name: "Karrot",
    }
  ],
} satisfies SourceInfo;
