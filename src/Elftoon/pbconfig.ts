import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Elftoon",
  description: "Extension that pulls content from elftoon.com (Cloudflare protected).",
  version: "1.0.0-alpha.3",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.EVERYONE,
  capabilities: [
    SourceIntents.DISCOVER_SECIONS,
    SourceIntents.MANGA_SEARCH,
    SourceIntents.MANGA_CHAPTERS,
    SourceIntents.CLOUDFLARE_BYPASS_REQUIRED
  ],
  badges: [],
  developers: [
    {
      name: "Karrot",
    }
  ],
} satisfies SourceInfo;
