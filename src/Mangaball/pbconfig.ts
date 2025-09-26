import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Mangaball",
  description: "Extension that pulls content from mangaball.net.",
  version: "1.0.0-alpha.1",
  icon: "icon.png",
  language: "multi",
  contentRating: ContentRating.ADULT,
  capabilities: [
    SourceIntents.DISCOVER_SECIONS,
    SourceIntents.MANGA_SEARCH,
    SourceIntents.MANGA_CHAPTERS,
  ],
  badges: [],
  developers: [
    {
      name: "Karrot",
    }
  ],
} satisfies SourceInfo;
