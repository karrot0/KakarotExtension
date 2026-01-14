import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Mangapark",
  description: "Extension that pulls content from mangapark.net.",
  version: "1.0.0-alpha.7",
  icon: "icon.png",
  language: "multi",
  contentRating: ContentRating.EVERYONE,
  capabilities: [
    SourceIntents.DISCOVER_SECIONS_PROVIDING,
    SourceIntents.SEARCH_RESULTS_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
    SourceIntents.SETTINGS_FORM_PROVIDING,
  ],
  badges: [],
  developers: [
    {
      name: "Karrot",
    }
  ],
} satisfies SourceInfo;
