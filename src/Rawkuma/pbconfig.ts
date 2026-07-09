import { ContentRating, ExtensionInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Rawkuma",
  description: "Extension that pulls content from https://rawkuma.net",
  version: "1.2",
  icon: "icon.png",
  language: "jp",
  contentRating: ContentRating.EVERYONE,
  badges: [
    { label: "Raw Provider", textColor: "#FFFFFF", backgroundColor: "#800080" },
  ],
  capabilities: [
    SourceIntents.DISCOVER_SECTION_PROVIDING,
    SourceIntents.SEARCH_RESULT_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
  ],
  developers: [
    {
      name: "Karrot",
    },
  ],
} satisfies ExtensionInfo;
