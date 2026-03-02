import { ContentRating, ExtensionInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Elftoon",
  description: "Extension that pulls content from elftoon.com (Cloudflare protected).",
  version: "1.0.0-alpha.3",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.EVERYONE,
  capabilities: [
    SourceIntents.DISCOVER_SECIONS_PROVIDING,
    SourceIntents.SEARCH_RESULTS_PROVIDING,
    SourceIntents.CHAPTER_PROVIDING,
    SourceIntents.CLOUDFLARE_BYPASS_PROVIDING,
  ],
  badges: [],
  developers: [
    {
      name: "Karrot",
    }
  ],
} satisfies ExtensionInfo;
