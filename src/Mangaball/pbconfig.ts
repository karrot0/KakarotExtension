import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Mangaball",
  description: "Extension that pulls content from mangaball.net.",
  version: "1.0.0-alpha.2",
  icon: "icon.png",
  language: "multi",
  contentRating: ContentRating.ADULT,
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
