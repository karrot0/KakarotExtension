import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
  name: "NovelFire",
  description: "Extension that pulls content from novelfire.net.",
  version: "1.0.0-alpha.1",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.EVERYONE,
  capabilities: [
    SourceIntents.DISCOVER_SECIONS,
    SourceIntents.MANGA_SEARCH,
    SourceIntents.MANGA_CHAPTERS,
  ],
  badges: [],
  developers: [
    {
      name: "Karrot",
    },
  ],
} satisfies SourceInfo;