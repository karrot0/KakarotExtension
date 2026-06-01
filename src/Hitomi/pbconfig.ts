import { ContentRating, ExtensionInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Hitomi",
  description: "Extension that pulls content from hitomi.la",
  version: "1.4.9",
  icon: "icon.png",
  language: "multi",
  contentRating: ContentRating.ADULT,
  capabilities: [
    SourceIntents.DISCOVER_SECTION_PROVIDING,
    SourceIntents.SEARCH_RESULT_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
    SourceIntents.SETTINGS_FORM_PROVIDING,
    SourceIntents.CLOUDFLARE_BYPASS_PROVIDING,
  ],
  badges: [],
  developers: [
    {
      name: "pisshammy",
      website: "$1/goon\nzelle: pisshammy@gmail.com\ncashapp: $0hammy0",
    },
  ],
} satisfies ExtensionInfo;
