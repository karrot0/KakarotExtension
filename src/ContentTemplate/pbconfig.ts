import { ContentRating, SourceInfo, SourceIntents } from "@paperback/types";

export default {
  name: "Content Template",
  description: "Content template extension",
  version: "0.9.0",
  icon: "icon.png",
  language: "en",
  contentRating: ContentRating.EVERYONE,
  badges: [
    { label: "Template", textColor: "#FFFFFF", backgroundColor: "#F64B4B" },
    { label: "Content", textColor: "#FFFFFF", backgroundColor: "#03C04A" },
  ],
  capabilities: [
    SourceIntents.SETTINGS_UI,
    SourceIntents.HOMEPAGE_SECTIONS,
    SourceIntents.MANGA_SEARCH,
    SourceIntents.MANGA_CHAPTERS,
  ],
  developers: [
    {
      name: "Celarye",
      website: "https://celarye.dev",
      github: "https://github.com/Celarye",
    },
  ],
} satisfies SourceInfo;
