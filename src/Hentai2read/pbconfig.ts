import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Hentai2read",
  description: "Extension that pulls content from hentai2read.com.",
  version: "1.0.0-alpha.1",
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
