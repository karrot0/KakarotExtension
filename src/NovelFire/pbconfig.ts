import { ContentRating, ExtensionInfo, SourceIntents } from "@paperback/types";

export default {
  name: "NovelFire",
  description: "Extension that pulls content from novelfire.net.",
  version: "1.0.0-alpha.2",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.EVERYONE,
  capabilities: [
    SourceIntents.DISCOVER_SECTION_PROVIDING,
    SourceIntents.SEARCH_RESULT_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
  ],
  badges: [],
  developers: [
    {
      name: "Karrot",
    },
  ],
} satisfies ExtensionInfo;