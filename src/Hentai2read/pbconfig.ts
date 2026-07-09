import { ContentRating, ExtensionInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Hentai2read",
  description: "Extension that pulls content from hentai2read.com.",
  version: "1.1",
  icon: "icon.png",
  language: "multi",
  contentRating: ContentRating.ADULT,
  capabilities: [
    SourceIntents.DISCOVER_SECTION_PROVIDING,
    SourceIntents.SEARCH_RESULT_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
  ],
  badges: [],
  developers: [
    {
      name: "Karrot",
    }
  ],
} satisfies ExtensionInfo;
