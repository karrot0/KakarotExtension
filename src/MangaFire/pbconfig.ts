import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
  name: "MangaFire",
  description: "A paperback extension for MangaFire",
  version: "0.9.0",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.EVERYONE,
  badges: [
    { label: "ALL MANGA", textColor: "#FFFFFF", backgroundColor: "#F64B4B" },
    { label: "BEST QUALITY", textColor: "#FFFFFF", backgroundColor: "#03C04A" },
  ],
  capabilities: [
    SourceIntents.DISCOVER_SECIONS,
    SourceIntents.MANGA_SEARCH,
    SourceIntents.MANGA_CHAPTERS,
  ],
  developers: [
    {
      name: "Karrot",
    },
    {
      name: "nyzzik",
    },
  ],
} satisfies SourceInfo;
