import { ContentRating, ExtensionInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Batcave",
  description: "Extension that pulls content from batcave.biz.",
  version: "1.4",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.EVERYONE,
  badges: [],
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
