import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
  name: "NHentai",
  description: "Extension that pulls content from nhentai.net",
  version: "2.1.0",
  icon: "icon.png",
  language: "multi",
  contentRating: ContentRating.ADULT,
  capabilities: [
    SourceIntents.DISCOVER_SECIONS,
    SourceIntents.MANGA_SEARCH,
    SourceIntents.MANGA_CHAPTERS,
    SourceIntents.SETTINGS_UI,
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
