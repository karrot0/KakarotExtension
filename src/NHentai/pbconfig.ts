import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
  name: "NHentai",
  description: "Extension that pulls content from nhentai.net",
  version: "2.1.0",
  icon: "icon.png",
  language: "multi",
  contentRating: ContentRating.ADULT,
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
    },
    {
      name: "pisshammy",
    },
  ],
} satisfies SourceInfo;
